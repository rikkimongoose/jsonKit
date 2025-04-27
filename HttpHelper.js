const liveReloadHeader = {
    'Content-Type':'text/event-stream',
    'Cache-Control':"no-cache, no-store, must-revalidate",
    'Connection':'keep-alive'
};

class HttpHelper {
    makeLiveReload(res) {
        Object.entries(liveReloadHeader).forEach(([header, value]) => res.setHeader(header, value));
    }
}

module.exports = HttpHelper;