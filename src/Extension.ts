import {ComTunnel} from "./ComTunnel/ComTunnel";

const Extension = {
    ComTunnel: {
        create: () => {
            return ComTunnel.create();
        },
        connect: (socketId: string) => {
            return ComTunnel.connect(socketId);
        }
    }
}

export default Extension