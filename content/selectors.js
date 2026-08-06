globalThis.ArchiveItSelectors = Object.freeze({
  title: ['h1', '.subject', '.title', '[class*="title"]', '[class*="subject"]'],
  article: ['article', '.article-content', '.board-content', '.view-content', '.content', '[class*="article"]', '[class*="content"]'],
  excluded: ['nav','header','footer','aside','button','script','style','noscript','svg','.comment','[class*="comment"]','[class*="reply"]','[class*="profile"]']
});
