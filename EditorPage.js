import React, { useEffect, useRef, useState } from "react";
import Client from "./Client";
import Editor from "./Editor";
import { initSocket } from "../Socket";
import { ACTIONS } from "../Actions";
import {
  useNavigate,
  useLocation,
  Navigate,
  useParams,
} from "react-router-dom";
import { toast } from "react-hot-toast";
import axios from "axios";

// ✅ FIXED LANGUAGES
const LANGUAGES = [
  "python",
  "javascript",
  "cpp",
  "c",
  "java",
  "bash",
];

function EditorPage() {
  const [clients, setClients] = useState([]);
  const [output, setOutput] = useState("");
  const [isCompileWindowOpen, setIsCompileWindowOpen] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("python");
  const codeRef = useRef(null);

  const Location = useLocation();
  const navigate = useNavigate();
  const { roomId } = useParams();

  const socketRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      socketRef.current = await initSocket();

      const handleErrors = (err) => {
        console.log("Error", err);
        toast.error("Socket connection failed, Try again later");
        navigate("/");
      };

      socketRef.current.on("connect_error", handleErrors);
  socketRef.current.on("connect", () => {
  socketRef.current.emit(ACTIONS.JOIN, {
    roomId,
    username: Location.state?.username,
  });
});

console.log("User data:", Location.state);

      socketRef.current.on(
        ACTIONS.JOINED,
        ({ clients, username, socketId }) => {
          if (username !== Location.state?.username) {
            toast.success(`${username} joined the room.`);
          }
          setClients(clients);
          socketRef.current.emit(ACTIONS.SYNC_CODE, {
            code: codeRef.current,
            socketId,
          });
        }
      );

      socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
        toast.success(`${username} left the room`);
        setClients((prev) =>
          prev.filter((client) => client.socketId !== socketId)
        );
      });
    };

    init();

    return () => {
      socketRef.current && socketRef.current.disconnect();
      socketRef.current?.off(ACTIONS.JOINED);
      socketRef.current?.off(ACTIONS.DISCONNECTED);
    };
  }, []);

  if (!Location.state) {
    return <Navigate to="/" />;
  }

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success("Room ID copied");
    } catch {
      toast.error("Unable to copy Room ID");
    }
  };

  const leaveRoom = () => {
    navigate("/");
  };

  // ✅ FIXED RUN CODE FUNCTION
  const runCode = async () => {
    setIsCompiling(true);
    try {
      let lang = selectedLanguage;

      // safety mapping (optional but safe)
      if (lang === "python3") lang = "python";
      if (lang === "nodejs") lang = "javascript";

      const response = await axios.post("http://localhost:5000/run", {
        code: codeRef.current,
        language: lang,
      });

      setOutput(response.data.output || response.data.error);
    } catch (error) {
      console.error(error);
      setOutput(error.response?.data?.error || "Error running code");
    } finally {
      setIsCompiling(false);
    }
  };

  const toggleCompileWindow = () => {
    setIsCompileWindowOpen(!isCompileWindowOpen);
  };

  return (
    <div className="container-fluid vh-100 d-flex flex-column">
      <div className="row flex-grow-1">
        {/* Sidebar */}
        <div className="col-md-2 bg-dark text-light d-flex flex-column">
          <img
            src="/images/codecast.png"
            alt="Logo"
            className="img-fluid mx-auto"
            style={{ maxWidth: "150px", marginTop: "-43px" }}
          />
          <hr style={{ marginTop: "-3rem" }} />

          <div className="d-flex flex-column flex-grow-1 overflow-auto">
            <span className="mb-2">Members</span>
            {clients.map((client) => (
              <Client key={client.socketId} username={client.username} />
            ))}
          </div>

          <hr />

          <div className="mt-auto mb-3">
            <button className="btn btn-success w-100 mb-2" onClick={copyRoomId}>
              Copy Room ID
            </button>
            <button className="btn btn-danger w-100" onClick={leaveRoom}>
              Leave Room
            </button>
          </div>
        </div>

        {/* Editor */}
        <div className="col-md-10 text-light d-flex flex-column">
          {/* ✅ Language Dropdown */}
          <div className="bg-dark p-2 d-flex justify-content-end">
            <select
              className="form-select w-auto"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

          <Editor
            socketRef={socketRef}
            roomId={roomId}
            onCodeChange={(code) => {
              codeRef.current = code;
            }}
          />
        </div>
      </div>

      {/* Toggle Button */}
      <button
        className="btn btn-primary position-fixed bottom-0 end-0 m-3"
        onClick={toggleCompileWindow}
      >
        {isCompileWindowOpen ? "Close Compiler" : "Open Compiler"}
      </button>

      {/* Compiler Output */}
      {isCompileWindowOpen && (
        <div
          className="bg-dark text-light p-3"
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            height: "30vh",
            overflowY: "auto",
          }}
        >
          <div className="d-flex justify-content-between mb-2">
            <h5>Output ({selectedLanguage})</h5>
            <button
              className="btn btn-success"
              onClick={runCode}
              disabled={isCompiling}
            >
              {isCompiling ? "Running..." : "Run Code"}
            </button>
          </div>

          <pre className="bg-secondary p-2 rounded">
            {output || "Output will appear here"}
          </pre>
        </div>
      )}
    </div>
  );
}

export default EditorPage;