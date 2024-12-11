const socket = io();
const videoGrid = document.getElementById("video-grid");
const peers = {};
const configuration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// Get user's media
navigator.mediaDevices
    .getUserMedia({ video: true, audio: true })
    .then((stream) => {
        const localVideo = document.createElement("video");
        localVideo.srcObject = stream;
        localVideo.autoplay = true;
        localVideo.muted = true; // Mute self to avoid feedback
        localVideo.playsInline = true;
        localVideo.style.border = "1px solid black";
        localVideo.style.margin = "5px";
        videoGrid.appendChild(localVideo);

        // Notify server of joining
        socket.emit("join-room", "room1");

        // Connect to new users
        socket.on("user-joined", (userId) => connectToUser(userId, stream));

        // Connect to existing users in the room
        socket.on("all-users", (users) => {
            users.forEach((userId) => connectToUser(userId, stream));
        });

        // Handle incoming signals
        socket.on("signal", async ({ from, signal }) => {
            if (!peers[from]) {
                const peerConnection = createPeerConnection(from, stream);
                peers[from] = peerConnection;
            }

            const pc = peers[from];

            if (signal.type === "offer") {
                await pc.setRemoteDescription(new RTCSessionDescription(signal));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit("signal", { to: from, signal: pc.localDescription });
            } else if (signal.type === "answer") {
                await pc.setRemoteDescription(new RTCSessionDescription(signal));
            } else if (signal.candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(signal));
            }
        });

        // Handle user disconnections
        socket.on("user-disconnected", (userId) => {
            if (peers[userId]) {
                peers[userId].close();
                delete peers[userId];
            }

            // Remove the video element of the disconnected user
            const video = Array.from(videoGrid.children).find(
                (video) => video.dataset.userId === userId
            );
            if (video) {
                video.remove();
            }
        });
    });

// Create WebRTC PeerConnection
function createPeerConnection(userId, stream) {
    const peerConnection = new RTCPeerConnection(configuration);

    // Add local stream to PeerConnection
    stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

    // Handle incoming tracks
    peerConnection.ontrack = (event) => {
        const stream = event.streams[0];
        
        // Check if a video element for this stream already exists
        let video = Array.from(videoGrid.children).find(
            (v) => v.srcObject === stream
        );

        if (!video) {
            // Create a new video element for this remote stream
            video = document.createElement("video");
            video.srcObject = stream;
            video.autoplay = true;
            video.playsInline = true;
            video.style.border = "1px solid black";
            video.style.margin = "5px";
            videoGrid.appendChild(video);
        }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("signal", { to: userId, signal: event.candidate });
        }
    };

    return peerConnection;
}

// Connect to a new user
function connectToUser(userId, stream) {
    const peerConnection = createPeerConnection(userId, stream);
    peers[userId] = peerConnection;

    peerConnection
        .createOffer()
        .then((offer) => peerConnection.setLocalDescription(offer))
        .then(() => {
            socket.emit("signal", { to: userId, signal: peerConnection.localDescription });
        });
}
