const exportButton = document.querySelector('#export');
const closeButton = document.querySelector('#close');
const statusNode = document.querySelector('#status');

closeButton.addEventListener('click', () => window.close());

function status(message, kind = '') {
  statusNode.textContent = message;
  statusNode.className = kind;
}

function registerSuccessfulConversion() {
  const key = 'archiveitSuccessfulConversions';
  const current = Number.parseInt(localStorage.getItem(key) || '0', 10);
  const next = Number.isFinite(current) ? current + 1 : 1;
  localStorage.setItem(key, String(next));
  return next % 10 === 0;
}

async function currentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https:\/\/(?:[^/]+\.)?ewhaian\.com\/campus\/lineage\/detail\//i.test(tab.url || '')) {
    throw new Error('족보 게시글에서 실행해 주세요.');
  }
  return tab;
}

async function request(type) {
  const tab = await currentTab();
  try {
    return await chrome.tabs.sendMessage(tab.id, { type });
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/selectors.js', 'content/extractor.js', 'content/content.js']
      });
      return await chrome.tabs.sendMessage(tab.id, { type });
    } catch (error) {
      throw new Error('게시글 연결에 실패했습니다. 확장 프로그램을 새로고침한 뒤 게시글 탭을 다시 열어 주세요.');
    }
  }
}

exportButton.addEventListener('click', async () => {
  exportButton.disabled = true;
  status('게시글 안에서 인쇄 화면을 준비하는 중…');
  try {
    const response = await request('ARCHIVEIT_PRINT');
    if (!response?.ok) throw new Error(response?.error || '인쇄 화면을 만들지 못했습니다.');
    status('PDF 파일로 변환했습니다.', 'success');
    if (registerSuccessfulConversion()) {
      await request('ARCHIVEIT_CHEER').catch(() => {});
    }
  } catch (error) { status(error.message, 'error'); }
  finally { exportButton.disabled = false; }
});
