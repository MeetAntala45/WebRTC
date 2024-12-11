const socket = io();

// Video elements
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

// WebRTC variables
let localStream;
let peerConnection;
const configuration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// Get user media
navigator.mediaDevices
    .getUserMedia({ video: true, audio: true })
    .then((stream) => {
        localVideo.srcObject = stream;
        localStream = stream;
    })
    .catch((error) => console.error("Error accessing media devices.", error));

// Handle signaling
socket.on("signal", async ({ from, signal }) => {
    if (!peerConnection) createPeerConnection(from);

    if (signal.type === "offer") {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit("signal", { to: from, signal: peerConnection.localDescription });
    } else if (signal.type === "answer") {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
    } else if (signal.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(signal));
    }
});

// Create WebRTC connection
function createPeerConnection(peerId) {
    peerConnection = new RTCPeerConnection(configuration);

    // Add local stream to the connection
    localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

    // Handle incoming tracks
    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("signal", { to: peerId, signal: event.candidate });
        }
    };
}

// Start the call
socket.on("connect", () => {
    socket.emit("signal", { to: "ALL", signal: { type: "offer" } });
});
