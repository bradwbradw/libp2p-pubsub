import React from "react";
import { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
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
import { PeerCertificate } from "tls";

console.log({ RPC });

declare global {
  interface Window {
    libp2p: Libp2p<any>;
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

var libp2p: Libp2p<any>;
function Peers({ style }) {
  const [peers, setPeers] = useState([]);
  const [selfPeer, setSelfPeer] = useState("");
  const [libP2PInstance, setlibP2PInstance] = useState<Libp2p<any>>();

  if (!libP2PInstance) {
    console.log("setting up lib p2p instance");
    createLibp2p(libp2pDefaults()).then((lib) => {
      window.libp2p = lib;
      libp2p = lib;
      setlibP2PInstance(lib);
    });
  }
  const handler: EventHandler<CustomEvent<Message>> = (
    event: CustomEvent<Message>
  ): void => {
    if (event.detail.topic === topic) {
      console.log(decoder.decode(event.detail.data));
    }
  };

  useEffect(() => {
    const peerConnectHandler: EventHandler<CustomEvent> = (
      event: CustomEvent
    ): void => {
      var target = event.target as PeerEventTarget;
      console.log("discovered peer", target.peerId.toString());
      var newPeers = [...peers, target.peerId.toString()];
      setPeers(newPeers);
    };

    const selfPeerUpdateHandler: EventHandler<CustomEvent> = (
      event: CustomEvent
    ): void => {
      var target = event.target as PeerEventTarget;
      console.log("self peer update", target.peerId.toString());
      setSelfPeer(target.peerId.toString());
    };

    if (!libP2PInstance) return;
    console.log("got lib p2p instance");
    var libp2p = libP2PInstance;
    libp2p.addEventListener("peer:discovery", peerConnectHandler);
    libp2p.addEventListener("self:peer:update", selfPeerUpdateHandler);
    libp2p.services.pubsub.addEventListener("message", handler);
    libp2p.services.pubsub.subscribe(topic);

    return () => {
      console.log("teardown");
      libp2p.removeEventListener("peer:discovery", peerConnectHandler);
      libp2p.removeEventListener("self:peer:update", selfPeerUpdateHandler);
      libp2p.services.pubsub.removeEventListener("message", handler);
      libp2p.services.pubsub.unsubscribe(topic);
    };
  }, [libP2PInstance]);

  return (
    <div style={style}>
      <h2>self: </h2>
      <span>{selfPeer}</span>
      <h2>libp2p.getPeers()</h2>
      {libP2PInstance ? (
        libP2PInstance.getPeers().map((peer, i) => {
          var s = peer.toString();
          return (
            <div key={i + "" + s}>
              <p>{s}</p>
            </div>
          );
        })
      ) : (
        <p>initializing...</p>
      )}

      <h2>discovered peers</h2>
      {peers.map((peer, i) => {
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
root.render(
  <>
    <Peers
      style={{
        width: "45vw",
        height: "100vh",
        border: "1px solid blue",
        display: "inline-block",
        margin: "0.5em",
      }}
    />
    <Peers
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
