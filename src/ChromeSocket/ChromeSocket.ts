type ChromeSocketListener = (data: any) => void;

enum ChromeSocketSenderType {
    CONTENT_SCRIPT = "content_script",
    BACKGROUND = "background",
}

enum ChromeSocketEvent {
    CONNECT = "connect",
    MESSAGE = "message",
    DISCONNECT = "disconnect",
}

type ChromeSocketEventResponse = {
    [ChromeSocketEvent.CONNECT]: {
        from: ChromeSocketSenderType;
        socketId: number;
        timestamp: number;
    }
    [ChromeSocketEvent.MESSAGE]: any;
    [ChromeSocketEvent.DISCONNECT]: {
        from: ChromeSocketSenderType;
        socketId: number;
        timestamp: number;
    }
}

class ChromeSocket {
    private socketId: string;
    private listeners: { [key: string]: ChromeSocketListener[] } = {};

    private constructor(socketId: string = null) {
        this.socketId = socketId || this.generateSocketId();

        chrome.runtime.onMessage.addListener((message) => {
            if(message.action !== 'chrome-socket-action') {
                return;
            }

            if(message.socketId !== this.socketId) {
                return;
            }

            if(message.from === this.getSenderType()) {
                return;
            }

            if(this.listeners[message.event]) {
                this.listeners[message.event].forEach(listener => {
                    listener(message.data);
                });
            }

            return true;
        });
    }

    private getSenderType(): ChromeSocketSenderType {
        // trick to determine if we are in the content script or background script
        // window will be undefined in the content script
        try {
            if (window) {
                return ChromeSocketSenderType.CONTENT_SCRIPT;
            }
        } catch (e) {
            return ChromeSocketSenderType.BACKGROUND;
        }
    }

    private generateSocketId() {
        //uuidv4
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    public static create() {
        return new ChromeSocket();
    }

    public static connect(socketId: string) {
        return new ChromeSocket(socketId);
    }

    private on<K extends ChromeSocketEvent>(event: K, listener: (data: ChromeSocketEventResponse[K]) => void) {
        if(!this.listeners[event]) {
            this.listeners[event] = [];
        }

        this.listeners[event].push(listener);
    }

    public emit(event: string, ...args: any[]) {
        if(this.getSenderType() === ChromeSocketSenderType.CONTENT_SCRIPT) {
            chrome.runtime.sendMessage({ socketId: this.socketId, event, args }).then(()=> {});
        } else {
            chrome.tabs.query({}, tabs => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, {socketId: this.socketId, event, args}).then(() =>{});
                });
            });
        }
    }
}

export default ChromeSocket;