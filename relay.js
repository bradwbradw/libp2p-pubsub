import { mplex } from "@libp2p/mplex";
import { yamux } from "@chainsafe/libp2p-yamux";
import { createLibp2p } from "libp2p";
import { noise } from "@chainsafe/libp2p-noise";
import { circuitRelayServer } from "libp2p/circuit-relay";
import { webSockets } from "@libp2p/websockets";
import * as filters from "@libp2p/websockets/filters";
import { identifyService } from "libp2p/identify";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { peerId } from "./src/relay-peerid.js";
import { kadDHT } from "@libp2p/kad-dht";

import express from "express";
import http from "http";

console.log("peer id", peerId);

const server = await createLibp2p({
  peerId,
  addresses: {
    listen: ["/ip4/127.0.0.1/tcp/8001/ws"],
  },
  transports: [
    webSockets({
      filter: filters.all,
      //rejectUnauthorized: false,
    }),
  ],
  connectionEncryption: [noise()],
  streamMuxers: [mplex()],
  services: {
    identify: identifyService(),
    relay: circuitRelayServer(),
    pubsub: gossipsub(),
    dht: kadDHT({
      protocolPrefix: "/test",
      clientMode: false,
    }),
  },
});

server.addEventListener("peer:discovery", (evt) => {
  console.log("discovered peer", evt.target.peerId.toString());
});

console.log(
  "p2p addr: ",
  server.getMultiaddrs().map((ma) => ma.toString())
);

function reportPeers() {
  console.log(
    "peers",
    server?.getPeers().map((p) => {
      return p.toString(); // + " " + p?.getMultiaddrs().map((ma) => ma.toString());
    })
  );
}
setInterval(() => {
  reportPeers();
}, 2000);
