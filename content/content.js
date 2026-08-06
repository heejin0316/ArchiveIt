if (!globalThis.__archiveItListenerInstalled) {
  globalThis.__archiveItListenerInstalled = true;

  function safeFilename(value) {
    return (value || '족보')
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
      .replace(/\s+/g, ' ')
      .replace(/[. ]+$/g, '')
      .slice(0, 120);
  }

  function printArticle() {
    const article = globalThis.ArchiveItExtractor.extract();
    document.querySelector('#archiveit-print-root')?.remove();
    document.querySelector('#archiveit-print-style')?.remove();

    const pageImages = [...document.images];
    const printableImages = article.images.flatMap(item => {
      const index = Number(String(item.hint || '').split(':').pop());
      const source = pageImages[index];
      return source?.complete && source.naturalWidth && source.naturalHeight ? [source] : [];
    });
    const hasText = Boolean(article.text?.trim());
    const mode = hasText && printableImages.length ? 'mixed' : printableImages.length ? 'images' : 'text';
    const filename = safeFilename(article.title);
    const root = document.createElement('main');
    root.id = 'archiveit-print-root';
    root.dataset.mode = mode;

    if (mode !== 'images') {
      const copy = document.createElement('section');
      copy.className = 'archiveit-print-copy';
      if (hasText) {
        const text = document.createElement('div');
        text.className = 'archiveit-print-text';
        const formattedContent = globalThis.ArchiveItExtractor.contentClone();
        text.append(...formattedContent.childNodes);
        copy.append(text);
      }
      root.append(copy);
    }

    const cleanClone = source => {
      const clone = source.cloneNode(true);
      clone.removeAttribute('loading');
      clone.removeAttribute('width');
      clone.removeAttribute('height');
      return clone;
    };
    const measureMixedTextMm = () => {
      if (mode !== 'mixed') return 0;
      const measurement = document.createElement('div');
      measurement.className = 'archiveit-print-text';
      const formattedContent = globalThis.ArchiveItExtractor.contentClone();
      measurement.append(...formattedContent.childNodes);
      Object.assign(measurement.style, {
        position: 'fixed', left: '-10000px', top: '0', visibility: 'hidden',
        boxSizing: 'content-box', width: '178mm', padding: '16mm 0 6mm',
        fontFamily: 'Arial, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif',
        fontSize: '12pt', lineHeight: '1.75', whiteSpace: 'normal', wordBreak: 'break-word'
      });
      document.body.append(measurement);
      const heightMm = measurement.getBoundingClientRect().height * 25.4 / 96;
      measurement.remove();
      return heightMm;
    };
    const mixedTextHeightMm = measureMixedTextMm();
    let hasAppendedImage = false;
    printableImages.forEach((source, index) => {
      const renderedHeightMm = source.naturalHeight / source.naturalWidth * 178;
      if ((mode === 'mixed' || mode === 'images') && renderedHeightMm > 265) {
        let sliceTopMm = 0;
        let sliceIndex = 0;
        const remainingAfterTextMm = Math.max(0, 297 - mixedTextHeightMm);
        const useInlineFirstSlice = mode === 'mixed' && !hasAppendedImage && remainingAfterTextMm >= 60;
        while (sliceTopMm < renderedHeightMm - 0.01) {
          const capacityMm = useInlineFirstSlice && sliceIndex === 0 ? Math.min(265, remainingAfterTextMm) : 265;
          const sliceHeightMm = Math.min(capacityMm, renderedHeightMm - sliceTopMm);
          const page = document.createElement('section');
          page.className = 'archiveit-print-image-slice';
          if (useInlineFirstSlice && sliceIndex === 0) page.classList.add('archiveit-print-image-slice--inline');
          page.style.setProperty('--archiveit-slice-top', `${-sliceTopMm}mm`);
          page.style.setProperty('--archiveit-slice-height', `${sliceHeightMm}mm`);
          const viewport = document.createElement('div');
          viewport.className = 'archiveit-print-slice-viewport';
          viewport.append(cleanClone(source));
          page.append(viewport);
          root.append(page);
          sliceTopMm += sliceHeightMm;
          sliceIndex++;
        }
      } else {
        const page = document.createElement('section');
        page.className = 'archiveit-print-image-page';
        page.dataset.index = String(index);
        page.append(cleanClone(source));
        root.append(page);
      }
      hasAppendedImage = true;
    });

    const imagePageRules = mode === 'images'
      ? printableImages.map((image, index) => `
          @page archiveitImage${index}{size:${image.naturalWidth}px ${image.naturalHeight}px;margin:0}
          #archiveit-print-root[data-mode="images"] .archiveit-print-image-page[data-index="${index}"]{
            page:archiveitImage${index};width:${image.naturalWidth}px;height:${image.naturalHeight}px;
          }`).join('')
      : '';
    const style = document.createElement('style');
    style.id = 'archiveit-print-style';
    style.textContent = `
      #archiveit-print-root{display:none}
      @media print{
        @page{size:A4;margin:0}
        @page archiveitMixed{size:A4;margin:0}
        @page archiveitTallImage{size:A4;margin:0}
        ${imagePageRules}
        html,body{margin:0!important;padding:0!important;background:#fff!important}
        body>*:not(#archiveit-print-root){display:none!important}
        #archiveit-print-root{display:block!important;margin:0;background:#fff;color:#111;font-family:Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif}
        .archiveit-print-copy{box-sizing:border-box;white-space:pre-wrap;word-break:break-word}
        .archiveit-print-text{font-size:12pt;line-height:1.75;white-space:normal}
        .archiveit-print-text p{margin:0 0 .8em}
        .archiveit-print-text pre{white-space:pre-wrap}
        .archiveit-print-text strong,.archiveit-print-text b{font-weight:700}
        .archiveit-print-text em,.archiveit-print-text i{font-style:italic}
        .archiveit-print-text u{text-decoration:underline}
        #archiveit-print-root[data-mode="text"] .archiveit-print-copy{width:210mm;min-height:297mm;padding:20mm}
        #archiveit-print-root[data-mode="mixed"]{page:archiveitMixed;width:210mm}
        #archiveit-print-root[data-mode="mixed"] .archiveit-print-copy{box-sizing:border-box;width:210mm;margin:0;padding:16mm 16mm 6mm}
        #archiveit-print-root[data-mode="mixed"] .archiveit-print-image-page{box-sizing:border-box;width:210mm;margin:0 0 6mm;padding:0 16mm;display:block;break-inside:avoid;page-break-inside:avoid;overflow:hidden}
        #archiveit-print-root[data-mode="mixed"] .archiveit-print-image-page img{display:block!important;visibility:visible!important;max-width:178mm!important;max-height:265mm!important;width:auto!important;height:auto!important;margin:0 auto!important;object-fit:contain!important;break-inside:avoid;page-break-inside:avoid}
        #archiveit-print-root .archiveit-print-image-slice{page:archiveitTallImage;box-sizing:border-box;width:210mm;height:297mm;margin:0;padding:16mm;display:block;break-before:page;page-break-before:always;break-inside:avoid;page-break-inside:avoid;overflow:hidden}
        #archiveit-print-root .archiveit-print-image-slice:first-child{break-before:auto;page-break-before:auto}
        #archiveit-print-root[data-mode="mixed"] .archiveit-print-image-slice--inline{page:archiveitMixed;height:var(--archiveit-slice-height);padding:0 16mm;break-before:auto;page-break-before:auto}
        #archiveit-print-root .archiveit-print-slice-viewport{position:relative;width:178mm;height:var(--archiveit-slice-height);margin:0;overflow:hidden}
        #archiveit-print-root .archiveit-print-slice-viewport img{position:absolute!important;display:block!important;visibility:visible!important;left:0!important;top:var(--archiveit-slice-top)!important;width:178mm!important;height:auto!important;max-width:none!important;max-height:none!important;margin:0!important;object-fit:contain!important}
        #archiveit-print-root[data-mode="images"] .archiveit-print-image-page{box-sizing:border-box;padding:0;display:block;break-before:page;break-inside:avoid;overflow:hidden}
        #archiveit-print-root[data-mode="images"] .archiveit-print-image-page:first-child{break-before:auto}
        #archiveit-print-root[data-mode="images"] .archiveit-print-image-page img{display:block!important;visibility:visible!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:fill!important}
      }`;
    document.head.append(style);
    document.body.append(root);

    const previousTitle = document.title;
    const enforceFilename = () => { document.title = filename; };
    const cleanup = () => {
      document.title = previousTitle;
      root.remove();
      style.remove();
      window.removeEventListener('beforeprint', enforceFilename);
      window.removeEventListener('afterprint', cleanup);
    };
    enforceFilename();
    window.addEventListener('beforeprint', enforceFilename);
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => { enforceFilename(); window.print(); }, 300);
    setTimeout(() => { if (document.contains(root)) cleanup(); }, 120000);
    return { imageCount: printableImages.length, title: article.title, filename, mode };
  }

  function showCheer() {
    document.querySelector('#archiveit-cheer-host')?.remove();
    const host = document.createElement('div');
    host.id = 'archiveit-cheer-host';
    Object.assign(host.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      pointerEvents: 'none'
    });
    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `
      <style>
        .card {
          position: absolute;
          top: 24px;
          left: 50%;
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 260px;
          padding: 15px 16px 15px 18px;
          border: 1px solid #dce9e3;
          border-radius: 14px;
          background: #ffffff;
          color: #1f2925;
          box-shadow: 0 10px 30px rgba(25, 60, 44, 0.18);
          font: 700 15px/1.4 Arial, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
          transform: translateX(-50%);
          pointer-events: auto;
        }
        .message { flex: 1; text-align: center; }
        button {
          width: 24px;
          height: 24px;
          padding: 0;
          border: 0;
          border-radius: 50%;
          background: transparent;
          color: #8a918e;
          font-size: 17px;
          line-height: 24px;
          cursor: pointer;
        }
        button:hover { background: #f1f3f2; color: #4f5854; }
      </style>
      <div class="card" role="dialog" aria-label="아카이브잇 응원 메시지">
        <span class="message">벗들 공부 화이팅 💚</span>
        <button type="button" aria-label="닫기">×</button>
      </div>`;
    shadow.querySelector('button').addEventListener('click', () => host.remove());
    document.body.append(host);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    try {
      if (message.type === 'ARCHIVEIT_PRINT') sendResponse({ ok: true, ...printArticle() });
      else if (message.type === 'ARCHIVEIT_CHEER') { showCheer(); sendResponse({ ok: true }); }
    } catch (error) {
      sendResponse({ ok: false, error: error.message });
    }
  });
}
