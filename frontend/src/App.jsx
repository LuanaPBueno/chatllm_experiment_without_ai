const { useEffect, useMemo, useRef, useState, useCallback } = React;

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function InstructionsModal({ isOpen, onClose }) {
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setMessage("");
      getUserInstructions()
        .then((data) => {
          setInstructions(data.custom_instructions || "");
        })
        .catch(() => setMessage("Erro ao carregar instruções."))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await updateCustomInstructions(instructions.trim() ? instructions : null);
      setMessage("Instruções salvas com sucesso!");
      setTimeout(() => {
        onClose();
        setMessage("");
      }, 1000);
    } catch (err) {
      setMessage(err.message || "Erro ao salvar instruções.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 8px 0" }}>Instruções Personalizadas</h3>
        <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0 0 16px 0" }}>
          O que você gostaria que a IA soubesse sobre você para fornecer respostas melhores?
        </p>

        <form onSubmit={handleSave}>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Ex: Responda sempre em português, seja direto..."
            rows={6}
            style={textareaStyle}
            disabled={loading}
            autoFocus
          />
          {message && (
            <div style={{ fontSize: "0.85rem", margin: "8px 0", color: message.includes("sucesso") ? "#27ae60" : "#c0392b" }}>
              {message}
            </div>
          )}

          <div style={modalActionsStyle}>
            <button type="button" onClick={onClose} style={cancelBtnStyle} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" style={saveBtnStyle} disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const modalOverlayStyle = {
  position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
  background: "rgba(0, 0, 0, 0.4)", display: "flex", alignItems: "center",
  justifyContent: "center", zIndex: 1000,
};
const modalContentStyle = {
  background: "var(--bg-page)", border: "1px solid var(--border)",
  padding: "24px", borderRadius: "12px", width: "100%", maxWidth: "480px",
  boxShadow: "0 4px 24px rgba(0, 0, 0, 0.12)",
};
const textareaStyle = {
  width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--composer-border)",
  font: "inherit", fontSize: "0.95rem", background: "var(--bg-page)", color: "var(--text)",
  resize: "vertical", outline: "none",
};
const modalActionsStyle = {
  display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px",
};
const cancelBtnStyle = {
  padding: "8px 16px", background: "transparent", border: "1px solid var(--border)",
  borderRadius: "8px", cursor: "pointer", color: "var(--text)", fontSize: "0.9rem",
};
const saveBtnStyle = {
  padding: "8px 16px", background: "var(--accent)", color: "#fff", border: "none",
  borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "0.9rem",
};

function App() {
  const [token, setToken] = useState(localStorage.getItem("access_token"));
  const [userEmail, setUserEmail] = useState(localStorage.getItem("user_email") || "");
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const messagesRef = useRef(null);
  const abortControllerRef = useRef(null);

  const chatHistory = useMemo(
    () => messages.filter((msg) => msg.role === "user" || msg.role === "assistant"),
    [messages]
  );

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Load sessions and set up initial state
  const loadSessions = useCallback(async () => {
    try {
      const sessionList = await listSessions();
      setSessions(sessionList);
      if (sessionList.length > 0) {
        const sid = sessionList[0].id;
        setActiveSessionId(sid);
        const msgs = await getSessionMessages(sid);
        if (msgs.length > 0) {
          setMessages(
            msgs.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
            }))
          );
        } else {
          setMessages([{ id: createMessageId(), role: "assistant", content: "Bem-vindo ao ChatLLM Lab. Como posso ajudar voce hoje?" }]);
        }
      } else {
        const newSession = await createSession();
        setSessions([newSession]);
        setActiveSessionId(newSession.id);
        setMessages([{ id: createMessageId(), role: "assistant", content: "Bem-vindo ao ChatLLM Lab. Como posso ajudar voce hoje?" }]);
      }
    } catch {
      try {
        const newSession = await createSession();
        setSessions([newSession]);
        setActiveSessionId(newSession.id);
        setMessages([{ id: createMessageId(), role: "assistant", content: "Bem-vindo ao ChatLLM Lab. Como posso ajudar voce hoje?" }]);
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (token) {
      loadSessions();
    }
  }, [token, loadSessions]);

  const selectSession = useCallback(async (sessionId) => {
    setActiveSessionId(sessionId);
    try {
      const msgs = await getSessionMessages(sessionId);
      if (msgs.length === 0) {
        setMessages([{ id: createMessageId(), role: "assistant", content: "Bem-vindo ao ChatLLM Lab. Como posso ajudar voce hoje?" }]);
      } else {
        setMessages(msgs.map((m) => ({ id: m.id, role: m.role, content: m.content })));
      }
    } catch {
      setMessages([{ id: createMessageId(), role: "assistant", content: "Bem-vindo ao ChatLLM Lab. Como posso ajudar voce hoje?" }]);
    }
  }, []);

  const onAuthSuccess = async (newToken, email) => {
    setToken(newToken);
    setUserEmail(email);
  };

  const refreshSessions = useCallback(async () => {
    try {
      const sessionList = await listSessions();
      setSessions(sessionList);
    } catch {}
  }, []);

  const handleNewSession = async () => {
    try {
      const newSession = await createSession();
      setSessions((prev) => [newSession, ...prev]);
      selectSession(newSession.id);
      setSidebarOpen(true);
    } catch (err) {
      setError("Erro ao criar sessao");
    }
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      await deleteSession(sessionId);
      const newList = sessions.filter((s) => s.id !== sessionId);
      setSessions(newList);
      if (activeSessionId === sessionId) {
        if (newList.length > 0) {
          selectSession(newList[0].id);
        } else {
          handleNewSession();
        }
      }
    } catch (err) {
      setError("Erro ao excluir sessao");
    }
  };

  const handleSelectSession = async (sessionId) => {
    if (sessionId === activeSessionId) return;
    selectSession(sessionId);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_email");
    setToken(null);
    setUserEmail("");
    setSessions([]);
    setActiveSessionId(null);
    setMessages([]);
    setError("");
  };

  const onStop = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setBusy(false);
  };

  const onSubmit = async (event, inputRef) => {
    event.preventDefault();
    const cleaned = text.trim();
    if (!cleaned || busy) return;

    setError("");
    const userMessage = { id: createMessageId(), role: "user", content: cleaned };
    const assistantMessageId = createMessageId();

    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantMessageId, role: "assistant", content: "" },
    ]);
    setText("");
    setBusy(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const result = await sendMessageStream({
        message: cleaned,
        history: chatHistory,
        session_id: activeSessionId,
        signal: abortController.signal,
        onDelta: (delta) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: `${msg.content}${delta}` }
                : msg
            )
          );
        },
      });

      // Update session ID and title from the response
      if (result && result.session_id) {
        setActiveSessionId(result.session_id);
        if (result.title) {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === result.session_id ? { ...s, title: result.title } : s
            )
          );
        }
      }
      // Refresh sessions from server to stay in sync
      refreshSessions();
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId && !msg.content.trim()
            ? { ...msg, content: "Nao foi possivel obter resposta do modelo agora." }
            : msg
        )
      );
    } catch (err) {
      const aborted = err?.name === "AbortError";
      if (!aborted) {
        setError(err.message || "Falha inesperada ao gerar resposta.");
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: msg.content.trim() ? msg.content : "Nao foi possivel obter resposta do modelo agora." }
              : msg
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId && !msg.content.trim()
              ? { ...msg, content: "Resposta interrompida." }
              : msg
          )
        );
      }
    } finally {
      // Always refresh sessions to pick up auto-title even if stream was incomplete
      refreshSessions();
      abortControllerRef.current = null;
      setBusy(false);
    }
  };

  if (!token) {
    return <Auth onAuthSuccess={onAuthSuccess} />;
  }

  return (
    <div className="app-layout">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
      />

      <main className="app-shell">
        <header className="app-header">
          <div className="header-left">
            <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="4" x2="15" y2="4" />
                <line x1="3" y1="9" x2="15" y2="9" />
                <line x1="3" y1="14" x2="15" y2="14" />
              </svg>
            </button>
            <div className="brand">ChatLLM Lab</div>
          </div>
          <div className="header-right">
            <span className="user-email">{userEmail}</span>
            <button className="logout-dev" onClick={() => setIsInstructionsOpen(true)} style={{background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', padding: '4px 14px', fontSize: '0.82rem', color: 'var(--text)', cursor: 'pointer'}}>
              Instruções
            </button>
            <button className="logout-btn" onClick={handleLogout}>Sair</button>
          </div>
        </header>

        <section className="messages" aria-live="polite" ref={messagesRef}>
          <div className="messages-inner">
            {messages.map((msg) => (
              <article key={msg.id} className={`bubble ${msg.role}`}>
                <MessageContent content={msg.content} />
              </article>
            ))}
          </div>
        </section>

        <Composer
          text={text}
          busy={busy}
          error={error}
          onChangeText={setText}
          onSubmit={onSubmit}
          onStop={onStop}
        />
      </main>
      <InstructionsModal
        isOpen={isInstructionsOpen}
        onClose={() => setIsInstructionsOpen(false)}
      />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

