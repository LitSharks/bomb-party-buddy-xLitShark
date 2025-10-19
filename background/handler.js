// background/handler.js
// Proxies API requests from content scripts (avoids page CORS)
// Needs host_permissions in manifest for https://extensions.litshark.ca/*

function ok(obj) { return { ok: true, ...obj }; }
function err(msg) { return { error: String(msg || 'unknown_error') }; }

// Small helper to do fetch with sane defaults
async function doFetch(url, init) {
  const res = await fetch(url, init);
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} :: ${text.slice(0,256)}`);
  }
  return text;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "extFetch") {
        const text = await doFetch(msg.url, { cache: "no-store", credentials: "omit" });
        sendResponse(ok({ text }));
        return;
      }
      if (msg?.type === "extPost") {
        const body = (typeof msg.body === "string") ? msg.body : JSON.stringify(msg.body || {});
        const text = await doFetch(msg.url, {
          method: "POST",
          mode: "cors",
          cache: "no-store",
          credentials: "omit",
          headers: {
            "Content-Type": "application/json",
          },
          body
        });
        sendResponse(ok({ text }));
        return;
      }
      sendResponse(err("unknown_message_type"));
    } catch (e) {
      sendResponse(err(e && e.message ? e.message : e));
    }
  })();
  // Keep the message channel open for async response
  return true;
});
