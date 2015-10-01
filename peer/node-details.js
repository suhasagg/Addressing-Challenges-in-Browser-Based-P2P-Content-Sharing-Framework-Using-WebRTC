var Id = require('dht-id');
var SimplePeer = require('simple-peer');
var bows = require('bows');
exports = module.exports = NodeDetails;

ndlog = bows('Node Details');

function NodeDetails(peer, peerId, n_fingers) {
        var self = this;
        var MOD = Math.pow(2, n_fingers);

        self.peerId = peerId;
        self.fingerTable = [];

        self.bootPeer = {
                peerId: null,
                connector: null
        };

        self.successor = self.peerId;;
        self.predecessor = null;
        self.succPreceding = null;

        self.channelTable = {};
        self.connectorTable = {};
        self.responseTable = {};
        self.marker;
        initializeFingerTable(n_fingers);

        function initializeFingerTable(n_fingers) {
                for (var i = 0; i < n_fingers; i++) {
                        var start = (self.peerId + Math.pow(2, i)) % MOD;
                        self.fingerTable[i] = {
                                start: start,
                                fingerId: self.peerId
                        };
                }
        }

        // self.join = function(destPeerId){}
        self.msgToSelf = function(srcPeerId, msgId, type, data, path, func, signal){
                signal = (typeof signal !== 'undefined') ? signal : null;

                peer.channelManager.messageHandler({
                        srcPeerId: srcPeerId,
                        msgId: msgId,
                        path: path,
                        type: type,
                        data: data,
                        func: func,
                        signal: signal
                });
        }

        self.findSuccessor = function(destPeerId, id, path, msgId, func, signal){
                ndlog("FIND SUCCESSOR(" + destPeerId +", "+ id +", "+ path +", "+ msgId +", "+ func +", "+ "signal"+ ")");
                if(destPeerId == self.peerId){
                        if(self.peerId == self.successor)
                                self.msgToSelf(self.peerId, msgId, "response", self.peerId, path, func, null);
                        
                        else if(isBetween(id, self.peerId, self.successor) || id == self.successor){
                                var channel = self.connectorTable[self.successor];
                                path += ","+ self.peerId;
                                ndlog("sending to "+ self.successor);
                                ndlog({srcPeerId: self.peerId, msgId: msgId, path: path, type: "signal-accept", data: "", func: func, signal: signal });

                                channel.send({
                                        srcPeerId: self.peerId,
                                        msgId: msgId,
                                        path: path,
                                        type: "signal-accept",
                                        data: "",
                                        func: func,
                                        signal: signal
                                });
                                // self.msgToSelf(self.peerId, msgId, "response", self.successor, path, func, signal);
                        }
                        
                        else{
                                var node = self.closestPrecedingFinger(id);
                                if( node == self.peerId )
                                        self.findSuccessor(self.successor, id, path, msgId, func, signal); //O(n)
                                else
                                        self.findSuccessor(node, id, path, msgId, func, signal);           //O(log(n))
                        }
                }

                else{
                        var channel = self.connectorTable[destPeerId];
                        if(channel == null || channel == undefined) ndlog("Connector: "+ channel);
                        path += ","+ self.peerId;

                        ndlog("sending to "+ destPeerId);
                        ndlog({srcPeerId: self.peerId, msgId: msgId, path: path, type: "request", data: "nodeDetails.findSuccessor(" + destPeerId + "," + id + ",\"" + path + "\"," + msgId + ",\"" + func + "\",\'"+ signal+"\')", func: func, signal: signal });
                        channel.send({
                                srcPeerId: self.peerId,
                                msgId: msgId,
                                path: path,
                                type: "request",
                                data: "nodeDetails.findSuccessor(" + destPeerId + "," + id + ",\"" + path + "\"," + msgId + ",\"" + func + "\",\'"+ signal+"\')",
                                func: func,
                                signal: signal
                        });
                }
        }

        self.initFindSuccessor = function(destPeerId, id, path, msgId, func){
                var signalId = new Id().toDec();

                self.channelTable[signalId] = new SimplePeer({
                        initiator: true,
                        trickle: false
                });

                self.channelTable[signalId].on('signal', function(signal) {
                        signal.id = signalId;
                        signal = peer.channelManager.encodeSignal(signal);
                        self.findSuccessor(destPeerId, id, path, msgId, func, signal);
                });
        }

        self.initFindPredOfSucc = function(destPeerId, path, msgId, func){
                var signalId = new Id().toDec();

                self.channelTable[signalId] = new SimplePeer({
                        initiator: true,
                        trickle: false
                });

                self.channelTable[signalId].on('signal', function(signal) {
                        signal.id = signalId;
                        signal = peer.channelManager.encodeSignal(signal);
                        self.findPredOfSucc(destPeerId, path, msgId, func, signal);
                });
        }

        self.findPredOfSucc = function(destPeerId, path, msgId, func, signal){
                ndlog("FIND PREDOFSUCC(" + destPeerId +", "+ path +", "+ msgId +", "+ func +", signal)");
                if( destPeerId == self.peerId) {
                        if(self.peerId == self.successor)
                                self.msgToSelf(self.peerId, msgId, "response", self.predecessor, path, func, null);

                        else {
                                var channel = self.connectorTable[self.predecessor];
                                path += "," + self.peerId;
                                ndlog("sending to " + self.successor);
                                ndlog({srcPeerId: self.peerId, msgId: msgId, path: path, type: "signal-accept", data: "", func: func, signal: signal });

                                channel.send({
                                        srcPeerId: self.peerId,
                                        msgId: msgId,
                                        path: path,
                                        type: "signal-accept",
                                        data: "",
                                        func: func,
                                        signal: signal
                                });
                        }
                }
                else{
                        var channel = self.connectorTable[destPeerId];
                        if(channel == null || channel == undefined) ndlog("Connector: "+ channel);
                        path += ","+ self.peerId;

                        ndlog("sending to "+ destPeerId);
                        ndlog({srcPeerId: self.peerId, msgId: msgId, path: path, type: "request", data: "nodeDetails.findPredOfSucc(" + destPeerId + ",\"" + path + "\"," + msgId + ",\"" + func+ "\",\'"+ signal+"\')", func: func, signal: signal });
                        channel.send({
                                srcPeerId: self.peerId,
                                msgId: msgId,
                                path: path,
                                type: "request",
                                data: "nodeDetails.findPredOfSucc(" + destPeerId + ",\"" + path + "\"," + msgId + ",\"" + func + "\",\'"+ signal+"\')",
                                func: func,
                                signal: signal
                        });
                }

        }

        self.notifyPredecessor = function(destPeerId, data, path, msgId, func){
                ndlog("NOTIFY PREDECESSOR(" + destPeerId +", "+ data + ", "+ path +", "+ msgId +", "+ func +")");

                if( destPeerId == self.peerId){
                        ndlog("Hello");
                        self.predecessor = data;
                        self.msgToSelf(self.peerId, msgId, "response", null, path, func);
                }
                else{
                        var channel = self.connectorTable[destPeerId];
                        if(channel == null || channel == undefined) ndlog("Connector: "+ channel);
                        path += ","+ self.peerId;

                        ndlog("sending to "+ destPeerId);
                        ndlog({srcPeerId: self.peerId, msgId: msgId, path: path, type: "request", data: "nodeDetails.notifyPredecessor(" + destPeerId + "," + data + ",\"" + path + "\"," + msgId + ",\"" + func + "\" )", func: func });
                        channel.send({
                                srcPeerId: self.peerId,
                                msgId: msgId,
                                path: path,
                                type: "request",
                                data: "nodeDetails.notifyPredecessor(" + destPeerId + "," + data + ",\"" + path + "\"," + msgId + ",\"" + func + "\" )",
                                func: func
                        });
                }

        }
         //"nodeDetails.stabilize(52,",45",38326717949206,"self.joinNetwork(4,38326717949206)" )"
        self.stabilize = function(destPeerId, path, msgId, func){
                ndlog("STABILIZE(" + destPeerId +", "+  path +", "+ msgId +", "+ func +")");
                if( destPeerId == self.peerId){
                        var data = {
                                srcPeerId: self.peerId,
                                msgId: msgId,
                                type: "response",
                                data: null,
                                path: path,
                                func: func
                        }
                        peer.channelManager.joinNetwork( "stabilize", data);
                        // self.msgToSelf(self.peerId, msgId, "response", null, path, func);
                }
                
                else{
                        var channel = self.connectorTable[destPeerId];
                        ndlog("Connector: "+ channel);
                        path += ","+ self.peerId;

                        channel.send({
                                srcPeerId: self.peerId,
                                msgId: msgId,
                                path: path,
                                type: "request",
                                data: "nodeDetails.stabilize(" + destPeerId + ",\"" + path + "\"," + msgId + ",\"" + func + "\" )",
                                func: func
                        });
                }

        }

        self.fixFingers = function(){
                ndlog("CALLED FIX FINGERS");
                for (var i = 0; i < self.fingerTable.length; i++) {
                        var key = self.fingerTable[i].start;
                        var msgId = new Id().toDec();
                        self.responseTable[msgId] = null;
                        self.initFindSuccessor(
                                self.peerId,
                                key,
                                "",
                                msgId,
                                "nodeDetails.fingerTable["+i+"].fingerId = " + "message.data;"
                        );
                };
        }

        self.closestPrecedingFinger = function(id){
                for (var i = n_fingers - 1; i >= 0; i--) {
                        var fingerId = self.fingerTable[i].fingerId;
                        if (isBetween(fingerId, self.peerId, id))
                                return fingerId;
                }
                return self.peerId;
        }

        /* peerId <belongs to> (fromKey,toKey) exclusive*/
        function isBetween(peerId, fromKey, toKey) {
                if (fromKey > toKey) return (peerId > fromKey || peerId < toKey);
                else return (peerId > fromKey && peerId < toKey);
        }
}