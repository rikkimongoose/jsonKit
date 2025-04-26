import { forOwn } from 'lodash';

const liveReloadHeader = {
    'Content-Type':'text/event-stream',
    'Cache-Control':"no-cache, no-store, must-revalidate",
    'Connection':'keep-alive'
};

class HttpHelper {
    makeLiveReload(res) {
        forOwn(liveReloadHeader, (value, header) => res.setHeader(header, value));
    }
}