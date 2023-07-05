import React from "react";
import { useEffect, useState, useRef } from "react";
import ReactDOM from "react-dom/client";
import { EventHandler } from "@libp2p/interfaces/events";
import { Message } from "@libp2p/interface-pubsub";
import { createLibp2p, type Libp2p } from "libp2p";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { bootstrap } from "@libp2p/bootstrap";
import { type DualKadDHT, kadDHT } from "@libp2p/kad-dht";
import { mplex } from "@libp2p/mplex";
import { webRTC, webRTCDirect } from "@libp2p/webrtc";
import { webSockets } from "@libp2p/websockets";
import { webTransport } from "@libp2p/webtransport";
import { ipnsSelector } from "ipns/selector";
import { ipnsValidator } from "ipns/validator";
import { autoNATService } from "libp2p/autonat";
import { circuitRelayTransport } from "libp2p/circuit-relay";
import { identifyService } from "libp2p/identify";
import type { PubSub } from "@libp2p/interface-pubsub";
import type { Libp2pOptions } from "libp2p";
import { multiaddr } from "@multiformats/multiaddr";
import { all } from "@libp2p/websockets/filters";
import { peerId } from "./relay-peerid.js";
import type { ConnectionGater } from "@libp2p/interface-connection-gater";
import { RPC } from "@chainsafe/libp2p-gossipsub/message";
//import { PeerCertificate } from "tls";

console.log({ RPC });

declare global {
  interface Window {
    libp2p1: Libp2p<any>;
    libp2p2: Libp2p<any>;
    multiaddr: any;
  }
}
window.multiaddr = multiaddr;

const topic = "test";
const decoder = new TextDecoder();

const connectionGater = (): ConnectionGater => {
  return {
    denyDialPeer: async () => false,
    denyDialMultiaddr: async () => false,
    denyInboundConnection: async () => false,
    denyOutboundConnection: async () => false,
    denyInboundEncryptedConnection: async () => false,
    denyOutboundEncryptedConnection: async () => false,
    denyInboundUpgradedConnection: async () => false,
    denyOutboundUpgradedConnection: async () => false,
    filterMultiaddrForPeer: async () => true,
  };
};

export function libp2pDefaults(): Libp2pOptions<{
  dht: DualKadDHT;
  pubsub: PubSub;
  identify: unknown;
  autoNAT: unknown;
}> {
  return {
    addresses: {
      listen: ["/webrtc"],
    },
    transports: [
      webRTC(),
      webRTCDirect(),
      webTransport(),
      webSockets({ filter: all }),
      circuitRelayTransport({
        discoverRelays: 1,
      }),
    ],
    connectionGater: connectionGater(),
    connectionEncryption: [noise()],
    peerDiscovery: [
      bootstrap({
        list: [`/ip4/127.0.0.1/tcp/8001/ws/p2p/${peerId.toString()}`],
      }),
    ],
    streamMuxers: [yamux(), mplex()],
    services: {
      identify: identifyService(),
      autoNAT: autoNATService(),
      pubsub: gossipsub(),
      dht: kadDHT({
        protocolPrefix: "/test",
        clientMode: true,
        validators: {
          ipns: ipnsValidator,
        },
        selectors: {
          ipns: ipnsSelector,
        },
      }),
    },
  };
}

interface PeerEventTarget extends EventTarget {
  peerId: {
    toString: () => string;
  };
}

function Peers({ style, libP2PInstance }) {
  const [discoveredPeers, setDiscoveredPeers] = useState([]);
  const [peerStore, setPeerStore] = useState([]); //libP2PInstance.getPeers()

  if (!libP2PInstance) {
    console.log("there is no lib p2p instance");
  }
  const handler: EventHandler<CustomEvent<Message>> = (
    event: CustomEvent<Message>
  ): void => {
    if (event.detail.topic === topic) {
      console.log(decoder.decode(event.detail.data));
    }
  };

  var interval = useRef(null);
  useEffect(() => {
    const peerConnectHandler: EventHandler<CustomEvent> = (
      event: CustomEvent
    ): void => {
      var target = event.target as PeerEventTarget;
      console.log("discovered peer", target.peerId.toString());
      var newPeers = [...discoveredPeers, target.peerId.toString()];
      setDiscoveredPeers(newPeers);
    };

    if (!libP2PInstance) return;
    console.log("got lib p2p instance");
    var libp2p = libP2PInstance;
    libp2p.addEventListener("peer:discovery", peerConnectHandler);
    libp2p.services.pubsub.addEventListener("message", handler);
    libp2p.services.pubsub.subscribe(topic);

    interval.current = setInterval(() => {
      console.log("update peer store");
      setPeerStore(libp2p.getPeers());
    }, 500);

    return () => {
      console.log("teardown");
      libp2p.removeEventListener("peer:discovery", peerConnectHandler);
      libp2p.services.pubsub.removeEventListener("message", handler);
      libp2p.services.pubsub.unsubscribe(topic);
      clearInterval(interval.current);
    };
  }, [libP2PInstance, discoveredPeers]);

  //  setPeerStore(libP2PInstance.getPeers());
  return (
    <div style={style}>
      <h2>self: </h2>
      <span>{libP2PInstance.peerId.toString()}</span>
      <h2>libp2p.getPeers()</h2>
      {peerStore.map((peer, i) => {
        var s = peer.toString();
        return (
          <div key={i + "" + s}>
            <p>{s}</p>
          </div>
        );
      })}
      <h2>discovered peers</h2>
      {discoveredPeers.map((peer, i) => {
        var s = peer.toString();
        return (
          <div key={i + "" + s}>
            <p>{s}</p>
          </div>
        );
      })}
    </div>
  );
}

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

Promise.all([
  createLibp2p(libp2pDefaults()).then((lib) => {
    window.libp2p1 = lib;
    return lib;
  }),
  createLibp2p(libp2pDefaults()).then((lib) => {
    window.libp2p2 = lib;
    return lib;
  }),
]).then(([lib1, lib2]) => {
  root.render(
    <>
      <pre>
        There are two libp2p instances: use "libp2p1" and "libp2p2" in the
        console to interact directly
      </pre>
      <Peers
        libP2PInstance={lib1}
        style={{
          width: "45vw",
          height: "100vh",
          border: "1px solid blue",
          display: "inline-block",
          margin: "0.5em",
        }}
      />
      <Peers
        libP2PInstance={lib2}
        style={{
          width: "45vw",
          height: "100vh",
          float: "right",
          display: "inline-block",
          border: "1px solid green",
          margin: "0.5em",
        }}
      />
    </>
  );
});
