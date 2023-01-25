import ChromeSocket from "./ChromeSocket/ChromeSocket";

const Extension = {
    socket: {
        create: () => {
            return ChromeSocket.create();
        },
        connect: (socketId: string) => {
            return ChromeSocket.connect(socketId);
        }
    }
}

export default Extension