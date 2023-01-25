import {
    ComTunnelListener,
    ComTunnelSender,
    ComTunnelEvent
} from "./common";

export class ComTunnel {
    private static readonly action = "com-tunnel-action";
    private static readonly authAction = "com-tunnel-auth-action";
    private static completeConnections: string[] = [];
    private static createdUuids: string[] = [];

    private readonly tunnelId: string;
    private isOpen: boolean = false;
    private listeners: { [key: string]: ComTunnelListener[] } = {};
    private secret: string;

    private constructor(tunnelId: string, secret: string = null) {
        this.tunnelId = tunnelId;
        this.secret = secret;

        if (ComTunnel.getSenderType() === ComTunnelSender.BACKGROUND) {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                if (message.action !== ComTunnel.authAction) {
                    return false;
                }

                if (message.tunnelId !== this.tunnelId) {
                    return false;
                }

                if (ComTunnel.completeConnections.indexOf(this.tunnelId) !== -1) {
                    return false;
                }

                ComTunnel.completeConnections.push(this.tunnelId);
                sendResponse({
                    action: ComTunnel.authAction,
                    tunnelId,
                    success: true,
                    secret,
                });
                return false;
            });
        }
    }

    public open() {
        if (this.isOpen && this.secret) {
            return;
        }
        this.isOpen = true;

        chrome.runtime.onMessage.addListener((message) => {
            if (message.action !== ComTunnel.action) {
                return false;
            }

            if (message.tunnelId !== this.tunnelId) {
                return false;
            }

            if (message.secret !== this.secret) {
                return false;
            }

            if (message.from === ComTunnel.getSenderType()) {
                return false;
            }

            if (this.listeners[message.event]) {
                this.listeners[message.event].forEach(listener => {
                    listener(message.data);
                });
            }

            return false;
        });

        this.emit(ComTunnelEvent.CONNECT, {});
    }

    public on(event: ComTunnelEvent, listener: ComTunnelListener) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(listener);
    }

    private emit(event: ComTunnelEvent, data: any) {
        if (!this.isOpen) {
            throw new Error("ComTunnel is not open");
        }
        chrome.runtime.sendMessage({
            action: ComTunnel.action,
            tunnelId: this.tunnelId,
            secret: this.secret,
            from: ComTunnel.getSenderType(),
            event,
            data,
        });
    }

    public sendMessage(data: any) {
        this.emit(ComTunnelEvent.MESSAGE, data);
    }

    private static uniqueUuid() {
        const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });

        let unique = false;
        let id = null;
        while (!unique) {
            id = uuid();
            if (ComTunnel.createdUuids.indexOf(id) === -1) {
                unique = true;
            }
        }
        ComTunnel.createdUuids.push(id);
        return id;
    }

    public static create() {
        if (ComTunnel.getSenderType() !== ComTunnelSender.BACKGROUND) {
            throw new Error("ComTunnel can only be created in the background script");
        }

        const tunnelId = ComTunnel.uniqueUuid();
        const secret = ComTunnel.uniqueUuid();
        return new ComTunnel(tunnelId, secret);
    }

    public static async connect(tunnelId: string): Promise<ComTunnel> {
        return new Promise<ComTunnel>((resolve, reject) => {
            let gotResponse = false;
            // request secret
            chrome.runtime.sendMessage({
                action: ComTunnel.authAction,
                tunnelId,
            }, (response) => {
                if (response && response.success === true && response.secret && gotResponse === false) {
                    resolve(new ComTunnel(tunnelId, response.secret));
                } else if (gotResponse === false) {
                    reject();
                }
                gotResponse = true;
            });

            setTimeout(() => {
                if (gotResponse === false) {
                    reject();
                }
            }, 5000);
        });
    }

    private static getSenderType() {
        // trick to determine if we are in the content script or background script
        // window will be undefined in the content script
        try {
            if (window) {
                return ComTunnelSender.CONTENT_SCRIPT;
            }
        } catch (e) {
            return ComTunnelSender.BACKGROUND;
        }
    }

    public getId() {
        return this.tunnelId;
    }
}