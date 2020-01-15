// Access to localPeerConnection library
var lib = new localPeerConnectionLib();

// JavaScript variables holding stream, connection information, send and receive channels
var localStream, localPeerConnection, remotePeerConnection, sendChannel, receiveChannel, socket, remoteSocketId;
var callDone = true;

// JavaScript variables associated with chat buttons in the page
var sendButton = document.getElementById("sendButton");

// JavaScript variables associated with HTML5 video elements in the page
var localVideo = document.getElementById("localVideo");
var remoteVideo = document.getElementById("remoteVideo");

// JavaScript variables associated with call management buttons in the page
var startButton = document.getElementById("startButton");
var callButton = document.getElementById("callButton");
var hangupButton = document.getElementById("hangupButton");

// Just allow the user to click on the 'Call' button at start-up
sendButton.disabled = true;
startButton.disabled = false;
callButton.disabled = true;
hangupButton.disabled = true;

// Associate JavaScript handlers with click events on the buttons
sendButton.onclick = sendData;
startButton.onclick = start;
callButton.onclick = call;
hangupButton.onclick = hangup;

// This are the required sources navigator must have to make a videoconference
const constraints = { video:true, audio:true };

// JavaScript variable associated with proper
// configuration of an RTCPeerConnection object:
// use DTLS/SRTP
var pc_constraints = {
	'optional': [
				 {'DtlsSrtpKeyAgreement': true}
				 ]};

// This is an optional configuration string, associated with NAT traversal setup
var servers = null;

// Utility function for logging information to the JavaScript console
function log(text) {
  console.log("At time: " + (performance.now() / 1000).toFixed(3) + " --> " + text);
}

// Callback in case of success of the getUserMedia() call
function successCallback(stream){
  callButton.disabled = false;
  // Associate the local video element with the retrieved stream
  localVideo.srcObject = stream;
  localVideo.muted=true;

	localStream = stream;
	// Connect to signalling server
	socket = io.connect('https://192.168.1.42:9000');
	lib.setSocket(socket);

	socket.on('connect', function () {
		log("CONNECTED");
	});

	// Receive message from the other peer via the signalling server
	socket.on('message', function (message){
	  log('Received message:', message.type + " ");

	  if(message.type=="newUser"){
			remoteSocketId = message.msg;
			lib.setRemoteSocketId(remoteSocketId);
			// We can now enable the 'Call' button
			callButton.disabled = false;
			log('Message:', message.msg);
	  }
	  else if(message.type=="offer"){
			if(!callDone) call();

			// Create the remote PeerConnection object
			  remotePeerConnection = new RTCPeerConnection(servers, pc_constraints);
			  lib.setRemotePeerConnection(remotePeerConnection);
			  log("Created remote peer connection object remotePeerConnection");
			  // Add a handler associated with ICE protocol events...
			  remotePeerConnection.onicecandidate = lib.gotRemoteIceCandidate;
			  // ...and a second handler to be activated as soon as the remote stream becomes available
			  //remotePeerConnection.onaddstream = gotRemoteStream;
			  remotePeerConnection.ontrack = gotRemoteTrack;

			  // ...and data channel creation event
			  remotePeerConnection.ondatachannel = lib.gotReceiveChannel;

			  // ...do the same with the 'pseudo-remote' PeerConnection
			  // Note well: this is the part that will have to be changed if you want the communicating peers to become
			  // remote (which calls for the setup of a proper signaling channel)
			  remotePeerConnection.setRemoteDescription(new RTCSessionDescription(message.data));

			  // Create the Answer to the received Offer based on the 'local' description
			  remotePeerConnection.createAnswer(lib.gotRemoteDescription, lib.onSignalingError);

	  }
	  else if(message.type=="answer"){
			log("Answer from remotePeerConnection: \n" + message.data.sdp);
			  // Conversely, set the 'remote' description as the remote description of the local PeerConnection
			  localPeerConnection.setRemoteDescription(new RTCSessionDescription(message.data));
	  }
	  else if(message.type=="localCandidate"){
			// Add candidate to the remote PeerConnection
			remotePeerConnection.addIceCandidate(new RTCIceCandidate({sdpMLineIndex:message.data.sdpMLineIndex,candidate:message.data.candidate}));
	  }
	  else if(message.type=="remoteCandidate"){
			// Add candidate to the local PeerConnection
			localPeerConnection.addIceCandidate(new RTCIceCandidate({sdpMLineIndex:message.data.sdpMLineIndex,candidate:message.data.candidate}));
	  }else if(message.type=="hangup"){
		  console.log("Altre usuari ha desconnectat");
		  hangup();
	  }
	});


	socket.on('disconnect', function (socketId) {
		// ACABAR TRUCADA REMOTA
		console.log("DISCONNECT NOW!");
	});

}

// Function associated with clicking on the 'Start' button
// This is the event triggering all other actions
function start() {
  log("Requesting local stream");
  // First of all, disable the 'Start' button on the page
  startButton.disabled = true; //deshabilito el botó Start
  // Get ready to deal with different browser vendors...
  navigator.getUserMedia = navigator.getUserMedia;
   // || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
  // Now, call getUserMedia()
  navigator.mediaDevices.getUserMedia(constraints).then(successCallback).catch(onError);
  /*navigator.getUserMedia({audio:true, video:true}, successCallback,	
    function(error) {
      log("navigator.getUserMedia error: ", error);
    });*/
}

function onError(error){
  log("navigator.getUserMedia error: ", error);
}

//Handler for sending data to the 'remote' peer
function sendData() {
  var data = document.getElementById("dataChannelSend").value;
  sendChannel.send(data);
  log('Sent data: ' + data);
}

// Function associated with clicking on the 'Call' button
// This is enabled upon successful completion of the 'Start' button handler
function call() {
  callDone = true;
  // First of all, disable the 'Call' button on the page...
  callButton.disabled = true;
  // ...and enable the 'Hangup' button
  hangupButton.disabled = false;
  log("Starting call -> getVideoTracks");

  if (navigator.webkitGetUserMedia) {
	  // Log info about video and audio device in use
	  if (localStream.getVideoTracks().length > 0) {
	    log('Using video device: ' + localStream.getVideoTracks()[0].label);
	  }
	  if (localStream.getAudioTracks().length > 0) {
	    log('Using audio device: ' + localStream.getAudioTracks()[0].label);
	  }
  }

  RTCPeerConnection = window.RTCPeerConnection;
  RTCSessionDescription = window.RTCSessionDescription;
  RTCIceCandidate = window.RTCIceCandidate;

  log("RTCPeerConnection object: " + RTCPeerConnection);

  // Create the local PeerConnection object
  localPeerConnection = new RTCPeerConnection(servers, pc_constraints);
  lib.setLocalPeerConnection(localPeerConnection);
  log("Created local peer connection object localPeerConnection, with Data Channel");

  try {
	  // Note Well: SCTP-based reliable Data Channels supported in Chrome 29+ !
	  // use {reliable: false} if you have an older version of Chrome
	  sendChannel = localPeerConnection.createDataChannel("sendDataChannel",
	  		{reliable: true});
	  log('Created reliable send data channel');
  } catch (e) {
	  alert('Failed to create data channel!');
	  log('createDataChannel() failed with following message: ' + e.message);
  }
  // Add a handler associated with ICE protocol events
  localPeerConnection.onicecandidate = lib.gotLocalIceCandidate;

  // Associate handlers with data channel events
  sendChannel.onopen = lib.handleSendChannelStateChange;
  sendChannel.onclose = lib.handleSendChannelStateChange;

  // Add the local stream (as returned by getUserMedia() to the local PeerConnection
  localPeerConnection.addStream(localStream);
  log("Added localStream to localPeerConnection");

  // We're all set! Create an Offer to be 'sent' to the callee as soon as the local SDP is ready
  localPeerConnection.createOffer(lib.gotLocalDescription, lib.onSignalingError);

}

// Handler to be called when hanging up the call
function hangup() {
  log("Ending call");
  // Close PeerConnection(s)
  localPeerConnection.close();
  remotePeerConnection.close();
  // Reset local variables
  localPeerConnection = null;
  remotePeerConnection = null;
  // Disable 'Hangup' button
  hangupButton.disabled = true;
  // Enable 'Start' button to allow for new calls to be established
  startButton.disabled = false;

  // Close channels...
  log('Closing data channels');
  sendChannel.close();
  log('Closed data channel with label: ' + sendChannel.label);
  receiveChannel.close();
  log('Closed peer connections');
  // Rollback to the initial setup of the HTML5 page
  sendButton.disabled = true;
  dataChannelSend.value = "";
  dataChannelReceive.value = "";
  dataChannelSend.disabled = true;
  dataChannelSend.placeholder = "1: Press Call; 2: Enter text; 3: Press Send.";

  socket.disconnect();
  //refresquem la pagina
  location.reload(true);
}

// Handler to be called as soon as the remote stream becomes available
function gotRemoteTrack(track){
  // Associate the remote video element with the retrieved stream, needs to get the stream from the track.
  remoteVideo.srcObject = track.streams[0];
  log("Received remote stream");
}
