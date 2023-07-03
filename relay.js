import { mplex } from "@libp2p/mplex"
import { createLibp2p } from "libp2p"
import { noise } from "@chainsafe/libp2p-noise"
import { circuitRelayServer } from 'libp2p/circuit-relay'
import { webSockets } from '@libp2p/websockets'
import * as filters from '@libp2p/websockets/filters'
import { identifyService } from 'libp2p/identify'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { peerId } from './src/relay-peerid.js'

const server = await createLibp2p({
    peerId,
    addresses: {
        listen: ['/ip4/127.0.0.1/tcp/8001/ws']
    },
    transports: [
        webSockets({
            filter: filters.all
        }),
    ],
    connectionEncryption: [noise()],
    streamMuxers: [mplex()],
    services: {
        identify: identifyService(),
        relay: circuitRelayServer(),
        pubsub: gossipsub()
    }
})

console.log("p2p addr: ", server.getMultiaddrs().map((ma) => ma.toString()))
