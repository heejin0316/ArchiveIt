(function () {
  const S = globalThis.ArchiveItSelectors;
  const clean = value => (value || '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  const visible = el => { const r = el.getBoundingClientRect(); const c = getComputedStyle(el); return r.width > 0 && r.height > 0 && c.display !== 'none' && c.visibility !== 'hidden'; };
  const safeUrl = (value) => { try { const u = new URL(value, location.href); return /^(https?|blob|data):$/.test(u.protocol) ? u.href : ''; } catch { return ''; } };
  const srcsetLargest = srcset => (srcset || '').split(',').map(item => { const p=item.trim().split(/\s+/); return {url:safeUrl(p[0]),score:parseFloat(p[1])||0}; }).filter(x=>x.url).sort((a,b)=>b.score-a.score)[0]?.url || '';
  const urlScore = url => (/original|origin|\/api\/download\/|attach|file/i.test(url)?1000000:0) + (/(thumb|thumbnail|resize|small)/i.test(url)?-1000000:0);

  function titleElement() {
    for (const selector of S.title) for (const el of document.querySelectorAll(selector)) {
      const value=clean(el.innerText); if (visible(el) && /^20\d{2}년도?\//.test(value)) return el;
    }
    return [...document.querySelectorAll('h1,h2,h3')].find(el=>visible(el)&&clean(el.innerText).length>2) || null;
  }
  function meaningfulImages(el) {
    return [...el.querySelectorAll('img')].filter(img => (img.naturalWidth||img.width)>=300 && (img.naturalHeight||img.height)>=180).length;
  }
  function pickRoot() {
    const heading=titleElement();
    if (heading) {
      let node=heading.parentElement, best=null;
      while (node && node!==document.body) {
        const images=meaningfulImages(node), length=clean(node.innerText).length;
        const hasEnd=/댓글\s*\d|전체글|목록으로/.test(node.innerText||'');
        if ((images>0 || length>80) && !hasEnd) best=node;
        if (images>0 && length<5000 && !hasEnd) return node;
        node=node.parentElement;
      }
      if (best) return best;
    }
    const candidates=S.article.flatMap(s=>[...document.querySelectorAll(s)]).filter(el=>visible(el)&&!/전체글|목록으로/.test(el.innerText||''));
    return candidates.sort((a,b)=>meaningfulImages(b)-meaningfulImages(a)||(a.innerText?.length||0)-(b.innerText?.length||0))[0]||document.querySelector('main')||document.body;
  }
  function title() {
    const titleLine=(document.body?.innerText||'').split(/\r?\n/).map(clean).find(value=>/^20\d{2}년도?\//.test(value)&&value.length<=180);
    if(titleLine)return titleLine;
    for (const selector of S.title) for (const el of document.querySelectorAll(selector)) {
      const value=clean(el.innerText); if (visible(el) && value.length>=2 && value.length<=200) return value;
    }
    return clean(document.title.replace(/\s*[-|]\s*이화이언.*$/i,'')) || '게시글';
  }
  function imageCandidates(root) {
    const found = new Map();
    const add = (url, el, hint='') => {
      url=safeUrl(url); if (!url || /^data:/i.test(url)) return;
      const width=el?.naturalWidth||el?.width||0, height=el?.naturalHeight||el?.height||0;
      if (width && height && width<120 && height<120) return;
      const item={url,alt:clean(el?.alt||''),width,height,hint,score:width*height+urlScore(url)};
      if (!found.has(url) || found.get(url).score<item.score) found.set(url,item);
    };
    const pageImages=[...document.querySelectorAll('img')];
    root.querySelectorAll('img').forEach(img => {
      const domIndex=pageImages.indexOf(img);
      const candidates=[];
      const offer=(url,hint)=>{url=safeUrl(url);if(url)candidates.push({url,hint,score:urlScore(url)});};
      offer(srcsetLargest(img.getAttribute('srcset')),`srcset:${domIndex}`);
      ['data-original','data-origin','data-src','data-lazy-src','data-url','src'].forEach(a=>offer(img.getAttribute(a),`${a}:${domIndex}`));
      const anchor=img.closest('a[href]');
      if(anchor && (/\.(?:jpe?g|png|webp|gif|bmp)(?:\?|$)/i.test(anchor.href) || /\/api\/download\//i.test(anchor.href))) offer(anchor.href,`link:${domIndex}`);
      const best=candidates.sort((a,b)=>b.score-a.score)[0];if(best)add(best.url,img,best.hint);
    });
    root.querySelectorAll('*').forEach(el => { const bg=getComputedStyle(el).backgroundImage; for(const match of bg.matchAll(/url\(["']?(.+?)["']?\)/g)) add(match[1],el,'background'); });
    return [...found.values()].map(({score,...item})=>item);
  }
  function contentClone(root) {
    const clone=root.cloneNode(true);
    clone.querySelectorAll([...S.excluded,'img','iframe','object','embed','video','audio','form','input','textarea','select','h1','h2','h3','[class*="meta"]','[class*="info"]','[class*="author"]','[class*="date"]'].join(',')).forEach(el=>el.remove());
    clone.querySelectorAll('a').forEach(anchor=>anchor.replaceWith(...anchor.childNodes));
    [...clone.querySelectorAll('*')].forEach(el=>{const value=clean(el.textContent);if(/^(댓글\s*\d|전체글|목록으로)/.test(value)||/수강년도 및 학기|강의명|교수명|계보 종류/.test(value))el.remove();});
    clone.querySelectorAll('*').forEach(el=>{
      [...el.attributes].forEach(attribute=>{if(/^on/i.test(attribute.name)||attribute.name==='contenteditable')el.removeAttribute(attribute.name);});
    });
    return clone;
  }
  function text(root) {
    const clone=contentClone(root);
    const blockTags=new Set(['ADDRESS','ARTICLE','ASIDE','BLOCKQUOTE','DIV','DL','FIELDSET','FIGCAPTION','FIGURE','FOOTER','FORM','HEADER','HR','MAIN','NAV','OL','P','PRE','SECTION','TABLE','UL']);
    const serialize=node=>{
      if(node.nodeType===Node.TEXT_NODE)return node.nodeValue||'';
      if(node.nodeType!==Node.ELEMENT_NODE)return '';
      const tag=node.tagName;
      if(tag==='BR')return '\n';
      if(tag==='LI')return `\n• ${[...node.childNodes].map(serialize).join('')}\n`;
      if(tag==='TR')return `\n${[...node.childNodes].map(serialize).join('')}\n`;
      if(tag==='TD'||tag==='TH')return `${[...node.childNodes].map(serialize).join('')}\t`;
      const content=[...node.childNodes].map(serialize).join('');
      if(tag==='P'||tag==='BLOCKQUOTE'||tag==='PRE')return `\n\n${content}\n\n`;
      return blockTags.has(tag)?`\n${content}\n`:content;
    };
    let value=serialize(clone)
      .replace(/\u00a0/g,' ')
      .replace(/[ \t]+\n/g,'\n')
      .replace(/\n[ \t]+/g,'\n')
      .replace(/\n{3,}/g,'\n\n')
      .trim();
    const currentTitle=title(); if(value.startsWith(currentTitle)) value=value.slice(currentTitle.length).trim();
    return value;
  }
  function extract() { const root=pickRoot(); return {title:title(),text:text(root),images:imageCandidates(root),url:location.href,extractedAt:new Date().toISOString()}; }
  globalThis.ArchiveItExtractor={extract,contentClone:()=>contentClone(pickRoot())};
})();
