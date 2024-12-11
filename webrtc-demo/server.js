const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public")); // Serve static files

io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Relay signaling data
    socket.on("signal", (data) => {
        const { to, signal } = data;
        io.to(to).emit("signal", { from: socket.id, signal });
    });

    // Notify others about disconnection
    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
