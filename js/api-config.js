(function initTurfArenaConfig() {
    const DEFAULT_BACKEND_PORT = '5001';
    const storedApiHost = localStorage.getItem('apiHost');

    function buildDefaultApiHost() {
        if (window.location.protocol === 'file:') {
            return `http://127.0.0.1:${DEFAULT_BACKEND_PORT}`;
        }

        const hostname = window.location.hostname || '127.0.0.1';
        if (window.location.port === DEFAULT_BACKEND_PORT) {
            return window.location.origin;
        }

        return `${window.location.protocol}//${hostname}:${DEFAULT_BACKEND_PORT}`;
    }

    const apiHost = (
        storedApiHost && /^https?:\/\//i.test(storedApiHost)
            ? storedApiHost
            : buildDefaultApiHost()
    ).replace(/\/+$/, '');

    if (storedApiHost !== apiHost) {
        localStorage.setItem('apiHost', apiHost);
    }

    window.TurfArenaConfig = Object.freeze({
        apiHost,
        apiBaseUrl: `${apiHost}/api`
    });
}());
