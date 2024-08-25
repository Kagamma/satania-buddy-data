const e = React.createElement;
const { useState, useRef, useEffect, useLayoutEffect } = React;

const Themes = [
  { key: 'Dark', value: 'dark-mode' },
  { key: 'Light', value: 'light-mode' },
  { key: 'Hacker', value: 'hacker-mode' },
  { key: 'Yotsuba', value: 'yotsuba-mode' },
  { key: 'Yotsuba B', value: 'yotsuba-b-mode' },
];

const EditMode = {
  CHAT: 1,
  HISTORY: 2,
};

const CHAT_DISPLAY = 20;

const webuiCall = () => {
  if (window.webui !== undefined) {
    return webui;
  }
  return {
    call: (api, value = '') => {
      return fetch(`/api/v1/${api}`, {
        method: 'POST',
        cache: 'no-cache',
        body: value,
      }).then(res => {
        return res.text().then(text => text.trim());
      }).catch(err => {
        console.log(err);
      });
    },
  };
};

const useConfig = () => {
  const [config, setConfig] = useState({});

  useEffect(() => {
    const config = localStorage.getItem('___config');
    if (config && config !== '') {
      setConfig(JSON.parse(config));
    }
  }, []);

  setNewConfig = newConfig => {
    newConfig = {
      ...config,
      ...newConfig,
    };
    setConfig(newConfig);
    localStorage.setItem('___config', JSON.stringify(newConfig));
  };

  return [config, setNewConfig];
}

const useTheme = () => {
  const [config, setConfig] = useConfig();
  const [theme, setTheme] = useState(config.theme);

  useEffect(() => {
    document.documentElement.classList.remove(theme);
    document.documentElement.classList.add(config.theme);
    setTheme(config.theme);
  }, [config.theme])

  const setNewTheme = newTheme => {
    setConfig({
      theme: newTheme,
    });
  };

  return [theme, setNewTheme];
};

const getTimestamp = () => {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  const hh = String(today.getHours()).padStart(2, '0');
  const min = String(today.getMinutes()).padStart(2, '0');
  const ss = String(today.getSeconds()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd} ${hh}:${min}:${ss}`;
};

/**
 * Parser for parsing messages and generate corresponding HTML tags
 * @param {string} message input message
 * @returns {Array<Component>}
 */
const processMessage = message => {
  // Declaration
  const TokenKind = {
    TEXT: 1,
    ROUND_BRACKET_BEGIN: 2,
    ROUND_BRACKET_END: 4,
    ASTERISK_BEGIN: 5,
    ASTERISK_END: 6,
    CODEBLOCK_BEGIN: 7,
    CODEBLOCK_END: 8,
    DQUOTE_BEGIN: 9,
    DQUOTE_END: 10,
    TABLE_BEGIN: 11,
    TABLE_END: 12,
    NEWLINE: 99,
  };
  let pos;
  const tokenList = [];
  const blockStack = [];
  const elementList = [];
  // Lex
  const peekAtBlockStack = () => {
    if (blockStack.length === 0)
      return null;
    return blockStack[blockStack.length - 1];
  };
  const nextChar = () => {
    pos = pos + 1;
    if (pos >= message.length)
      return null;
    return message.charAt(pos);
  };
  const peekAtNextChar = (next = 1) => {
    const nextPos = pos + next;
    if (nextPos >= message.length)
      return null;
    return message.charAt(nextPos);
  };
  const peekAtPrevChar = (prev = 1) => {
    const prevPos = pos - prev;
    if (prevPos < 0)
      return null;
    return message.charAt(prevPos);
  };
  const isFromTo = (c, f, l) => {
    if (c === null)
      return false;
    const v = c.charCodeAt(0);
    if (v >= f.charCodeAt(0) && v <= l.charCodeAt(0))
      return true;
    return false;
  };
  const unicodeToChar = (text) => {
    return text.replace(/\\u[\dA-F]{4}/gi,
      match => {
        return String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16));
      });
  }
  const commonText = c => {
    if (tokenList.length > 0) {
      const token = tokenList[tokenList.length - 1];
      if (token.kind === TokenKind.TEXT) {
        token.value += c;
      } else {
        tokenList.push({
          kind: TokenKind.TEXT,
          value: c,
        });
      }
    } else {
      tokenList.push({
        kind: TokenKind.TEXT,
        value: c,
      });
    }
  };
  const lex = () => {
    pos = -1;
    while (pos < message.length) {
      let c = nextChar();
      switch (c) {
        case '*':
          if (isFromTo(peekAtNextChar(), 'A', 'z') && (blockStack.length === 0)) {
            blockStack.push(TokenKind.ASTERISK_BEGIN);
            tokenList.push({
              kind: TokenKind.ASTERISK_BEGIN,
              value: c,
            });
          } else
          if (peekAtBlockStack() === TokenKind.ASTERISK_BEGIN) {
            blockStack.pop();
            tokenList.push({
              kind: TokenKind.ASTERISK_END,
              value: c,
            });
          } else {
            commonText(c);
          }
          break;
        case '"':
          if (blockStack.length === 0) {
            blockStack.push(TokenKind.DQUOTE_BEGIN);
            tokenList.push({
              kind: TokenKind.DQUOTE_BEGIN,
              value: c,
            });
          } else
          if (peekAtBlockStack() === TokenKind.DQUOTE_BEGIN) {
            blockStack.pop();
            tokenList.push({
              kind: TokenKind.DQUOTE_END,
              value: c,
            });
          } else {
            commonText(c);
          }
          break;
        case '(':
          if (isFromTo(peekAtNextChar(), 'A', 'z') && (blockStack.length === 0)) {
            blockStack.push(TokenKind.ROUND_BRACKET_BEGIN);
            tokenList.push({
              kind: TokenKind.ROUND_BRACKET_BEGIN,
              value: c,
            });
          } else {
            commonText(c);
          }
          break;
        case ')':
          if (peekAtBlockStack() === TokenKind.ROUND_BRACKET_BEGIN) {
            blockStack.pop();
            tokenList.push({
              kind: TokenKind.ROUND_BRACKET_END,
              value: c,
            });
          } else {
            commonText(c);
          }
          break;
        case '`':
          if ((peekAtNextChar() === '`') && (peekAtNextChar(2) === '`') && (blockStack.length === 0) && ((peekAtPrevChar() === '\n') || (peekAtPrevChar() === null))) {
            while ((c !== '\n') && (c !== null)) {
              c = nextChar();
            }
            blockStack.push(TokenKind.CODEBLOCK_BEGIN);
            tokenList.push({
              kind: TokenKind.CODEBLOCK_BEGIN,
            });
          } else
          if ((peekAtNextChar() === '`') && (peekAtNextChar(2) === '`') && (peekAtBlockStack() === TokenKind.CODEBLOCK_BEGIN)) {
            while ((c !== '\n') && (c !== null)) {
              c = nextChar();
            }
            blockStack.pop();
            tokenList.push({
              kind: TokenKind.CODEBLOCK_END,
            });
          } else {
            commonText(c);
          }
          break;
        case '\n':
          if ((peekAtNextChar()) === '|' && (blockStack.length === 0)) {
            blockStack.push(TokenKind.TABLE_BEGIN);
            tokenList.push({
              kind: TokenKind.TABLE_BEGIN,
            });
            break;
          } else
          if ((peekAtNextChar()) !== '|' && (peekAtBlockStack() === TokenKind.TABLE_BEGIN)) {
            blockStack.pop();
            tokenList.push({
              kind: TokenKind.TABLE_END,
            });
          } else
          if ((blockStack.length > 0) && (peekAtBlockStack() !== TokenKind.TABLE_BEGIN)) {
            commonText(c);
          } else {
            tokenList.push({
              kind: TokenKind.NEWLINE,
            });
          }
          break;
        case '|':
          if (peekAtBlockStack() === TokenKind.TABLE_BEGIN) {
            s = '';
            while ((peekAtNextChar() !== '\n') && (peekAtNextChar() !== null) && (peekAtNextChar() !== '|')) {
              s += nextChar();
            }
            if ((peekAtNextChar() === '\n') && (s !== '') || (peekAtNextChar() === '|')) {
              tokenList.push({
                kind: TokenKind.TEXT,
                value: s,
              });
            }
          } else {
            commonText(c);
          }
          break;
        case null:
          break;
        default:
          if (blockStack.length > 0) {
            commonText(c);
          } else {
            if (c === '\n') {
              tokenList.push({
                kind: TokenKind.NEWLINE,
              });
            } else {
              commonText(c);
            }
          }
      }
    };
  };
  // Parse
  const parse = () => {
    let lastBlockKind = null;
    let table = null;
    let tableRows = null;
    let tableColumns = null;
    pos = 0;
    for (let i = 0; i < tokenList.length; i += 1) {
      const token = tokenList[i];
      if (token.kind === TokenKind.DQUOTE_BEGIN || token.kind === TokenKind.ASTERISK_BEGIN || token.kind === TokenKind.ROUND_BRACKET_BEGIN || token.kind === TokenKind.CODEBLOCK_BEGIN || token.kind === TokenKind.TABLE_BEGIN) {
        lastBlockKind = token.kind;
        if (token.kind === TokenKind.TABLE_BEGIN) {
          tableColumns = [];
          tableRows = [e('tr', { className: 'tr' }, tableColumns)];
          table = e('table', { className: 'table' }, tableRows);
          elementList.push(table);
        }
        continue;
      } else
      if (token.kind === TokenKind.DQUOTE_END || token.kind === TokenKind.ASTERISK_END || token.kind === TokenKind.ROUND_BRACKET_END || token.kind === TokenKind.CODEBLOCK_END || token.kind === TokenKind.TABLE_END) {
        lastBlockKind = null;
        continue;
      }
      if ((token.kind === TokenKind.NEWLINE) && (lastBlockKind !== TokenKind.TABLE_BEGIN)) {
         elementList.push(e('br'));
      } else {
        switch (lastBlockKind) {
          case TokenKind.ASTERISK_BEGIN:
            elementList.push(e('span', { className: 'chat-item-message-asterisk' }, token.value));
            break;
          case TokenKind.DQUOTE_BEGIN:
            elementList.push(e('span', { className: 'chat-item-message-double-quote' }, '"' + token.value + '"'));
            break;
          case TokenKind.ROUND_BRACKET_BEGIN:
            elementList.push(e('span', { className: 'chat-item-message-round-bracket' }, token.value));
            break;
          case TokenKind.TABLE_BEGIN:
            if (token.kind === TokenKind.NEWLINE) {
              tableColumns = [];
              tableRows.push(e('tr', { className: 'tr' }, tableColumns));
            } else {
              tableColumns.push(e(tableRows.length === 1 ? 'th' : 'td', { className: 'td' }, token.value));
            }
            break;
          case TokenKind.CODEBLOCK_BEGIN:
            elementList.push(e('pre', { dangerouslySetInnerHTML: {
              __html: hljs.highlightAuto(token.value).value,
            }}));
            break;
          default:
            if (token.value === TokenKind.NEWLINE)
              elementList.push(e('br'));
            else
              elementList.push(e('span', {}, unicodeToChar(token.value)));
        }
      }
    }
  };
  //
  lex();
  parse();
  return elementList;
};

/**
 * Show loading screen
 * @returns {Component}
 */
const Loading = () => {
  return e('div', { className: 'loading' }, [
    e('div', { className: 'spinner-grow' }),
    e('div', { className: 'spinner-grow' }),
    e('div', { className: 'spinner-grow' }),
  ]);
};

/**
 * Display a modal on screen
 * @param {*} props.title Modal title
 * @param {*} props.body Modal body
 * @param {*} props.footer Modal footer
 * @param {boolean} visible True = display modal on screen
 * @returns {Component}
 */
const Modal = ({
  title,
  body,
  footer,
  visible,
}) => {
  if (!visible)
    return null;
  return e('div', { className: 'modal' },
    e('div', { className: 'modal-dialog' },
      e('div', { className: 'modal-content' },
        e('div', { className: 'modal-header' }, [
          e('h5', { className: 'modal-title' }, title),
        ]),
        e('div', { className: 'modal-body', style: { maxHeight: 'calc(100vh - 300px)', overflowY: 'scroll' } }, body),
        e('div', { className: 'modal-footer' }, footer),
      ),
    )
  );
};

/**
 * Call this to display toast on screen
 * @param {*} props.message Toast message
 * @param {*} props.time Toast timeout in seconds. Default is 3.
 */
let toast = ({
  message
}) => {};
const toastListRef = { current: [] };

/**
 * Toast container and toast
 * @returns {Component}
 */
const Toast = ({

}) => {
  const [toastList, setToastList] = useState([]);

  const deleteToast = item => {
    toastListRef.current = toastListRef.current.filter(a => a !== item);
    setToastList(toastListRef.current);
  };

  toast = ({
    message,
    time = 3,
  }) => {
    const newToast = { message, time };
    toastListRef.current = [
      ...toastListRef.current,
      newToast,
    ];
    setToastList(toastListRef.current);
    const interval = setInterval(() => {
      newToast.time -= 1;
      if (newToast.time <= 0) {
        deleteToast(newToast);
        clearInterval(interval)
      }
    }, 1000);
  };

  return e('div', { className: 'toast-container position-fixed', style: { zIndex: '1000005', right: '20px', bottom: '60px' } }, toastList.map(item => {
    return e('div', { className: 'toast show', style: { width: 'auto' } },
      e('div', { className: 'toast-body' }, [
        e('i', { className: 'fa fa-solid fa-exclamation-circle me-2' }),
        item.message,
      ]),
    );
  }));
};

// A cache stores GUID and the generated react component array of a message.
// If GUID exists, then we reuse the generated react component array instead of generate a new one.
// TODO: Clean up cache
let chatItemComponentCache = {};

// -----
const NameKind = ['system', 'char', 'user'];

/**
 * Display one single chat message on screen
 * @param {function} props.onRenderChange Call when this message is new, or has been changed
 * @param {function} props.onMessageChange Call when the message content is changed
 * @param {function} props.onMessageChange Call when the message is deleted
 * @returns {Component}
 */
const ChatItem = ({
  guid,
  name,
  message,
  kind,
  onRenderChange,
  onMessageChange,
  onMessageDelete,
}) => {
  const [showEditor, setShowEditor] = useState(false);
  const [editMessage, setEditMessage] = useState(null);
  const [edited, setEdited] = useState(false);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const nameKind = NameKind[kind];

  const handleShowEditorClick = () => {
    delete chatItemComponentCache[guid];
    setShowEditor(true);
    setEditMessage(message);
    setEdited(true);
  };

  const handleHideEditorClick = () => {
    delete chatItemComponentCache[guid];
    setShowEditor(false);
    setEditMessage(null);
  };

  const handleApplyChangeClick = () => {
    delete chatItemComponentCache[guid];
    onMessageChange({
      guid,
      name,
      kind,
      message: editMessage,
    });
    setShowEditor(false);
  };

  const handleEditMessageChange = e => {
    setEditMessage(e.target.value);
  };

  const handleDeleteMessageClick = ()=> {
    setShowConfirmDeleteModal(false);
    onMessageDelete({ guid });
  };

  const handleShowConfirmDeleteModalClick = ()=> {
    setEdited(true);
    setShowConfirmDeleteModal(true);
  };

  const handleHideConfirmDeleteModalClick = ()=> {
    setShowConfirmDeleteModal(false);
  };

  const renderEditor = () => {
    return e('textarea', { className: 'chat-item-input', value: editMessage, onChange: handleEditMessageChange });
  };

  const renderCommands = () => {
    if (!showEditor) {
      return [
        e('button', { className: `btn btn-outline-secondary btn-sm me-1 no-border ${nameKind}`, title: 'Edit this message', onClick: handleShowEditorClick },
          e('i', { className: `fa fa-solid fa-pencil`, })
        ),
        e('button', { className: `btn btn-outline-secondary btn-sm no-border ${nameKind}`, title: 'Delete this message', onClick: handleShowConfirmDeleteModalClick },
          e('i', { className: `fa fa-solid fa-trash`, })
        ),
      ];
    } else {
      return [
        e('button', { className: `btn btn-primary btn-sm me-1 ${nameKind}`, title: 'Save changes', onClick: handleApplyChangeClick },
          e('i', { className: `fa fa-solid fa-save`, })
        ),
        e('button', { className: `btn btn-secondary btn-sm ${nameKind}`, title: 'Cancel', onClick: handleHideEditorClick },
          e('i', { className: `fa fa-solid fa-times`, })
        ),
      ];
    }
  };

  if (!chatItemComponentCache[guid] || showEditor) {
    chatItemComponentCache[guid] = e('div', { className: `chat-item-container ${nameKind}` }, [
      e('img', { className: `chat-item-avatar-container ${nameKind}`, src: `/chat/avatar_${kind}.png`, alt: name }, ),
      e('div', { className: `chat-item-text-container ${nameKind}` }, [
        e('div', { className: `chat-item-name-container ${nameKind}` },
          e('div', { className: `chat-item-name ${nameKind}` }, name),
          e('div', { className: `chat-item-commands-container ${nameKind}` },
            renderCommands(),
          ),
        ),
        e('div', { className: `chat-item-message-container ${nameKind}` },
          e('div', {}, showEditor ? renderEditor() : processMessage(message)),
        ),
      ]),
    ]);
    if (!showEditor && !edited) {
      onRenderChange();
    }
  }
  return [
    showConfirmDeleteModal && e(Modal, {
      visible: showConfirmDeleteModal,
      title: 'Confirmation',
      body: 'Do you want to delete this message?',
      footer: [
        e('button', { className: 'btn btn-primary', onClick: handleDeleteMessageClick }, [
          e('i', { className: 'fa fa-solid fa-check me-2' }),
          'Yes',
        ]),
        e('button', { className: 'btn btn-secondary', onClick: handleHideConfirmDeleteModalClick }, [
          e('i', { className: 'fa fa-solid fa-times me-2' }),
          'No',
        ]),
      ]
    }),
    chatItemComponentCache[guid],
  ];
};

/**
 * History editor component
 * @param {function} props.onEditModeChange Edit mode change callback.
 * @returns {Component}
 */
const HistoryEditor = ({
  onEditModeChange,
}) => {
  const [chatHistory, setChatHistory] = useState('');

  useEffect(() => {
    webuiCall().call('chat_history_plaintext_get', '').then(res => {
      setChatHistory(res);
    });
  }, []);

  const handleSaveChangeClick = () => {
    webuiCall().call('chat_history_plaintext_save', chatHistory).then(() => {
      onEditModeChange(EditMode.CHAT);
    });
  };

  const renderLayout = () => {
    handleChatInputChange = e => {
      setChatHistory(e.target.value);
    };
    return e('textarea', {
      className: 'history-input',
      value: chatHistory,
      onChange: handleChatInputChange,
    });
  };

  return [
    e('div', { className: 'app-container' }, [
      e('div', { className: 'app-content' }, renderLayout()),
      e('div', { className: 'app-commands' }, [
        e('div', { className: 'app-commands-left' }),
        e('div', { className: 'app-commands-right' }, [
          e('button', { className: 'btn btn-primary btn-sm me-2', type: 'button', title: 'Save changes', onClick: handleSaveChangeClick },
            e('i', { className: 'fa fa-solid fa-save' }),
          ),
          e('button', { className: 'btn btn-warning btn-sm me-2', type: 'button', title: 'Clear all chat messages', onClick: () => setChatHistory('') },
            e('i', { className: 'fa fa-solid fa-eraser' }),
          ),
          e('button', { className: 'btn btn-info btn-sm me-2', type: 'button', title: 'Back to chat window', onClick: () => onEditModeChange(EditMode.CHAT) },
            e('i', { className: 'fa fa-solid fa-arrow-left' }),
          ),
        ]),
      ]),
    ]),
  ];
};

/**
 * Left sidebar
 */
const SideBarLeft = ({
  chatHistory,
  onClose,
  onReload,
}) => {
  const [showSaveSessionModal, setShowSaveSessionModal] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [sessionList, setSessionList] = useState([]);

  helperReloadSessionList = () => {
    const a = Object.keys(localStorage).filter(a => a !== '___config');
    a.sort();
    setSessionList(a);
  };

  useEffect(() => {
    helperReloadSessionList();
  }, []);

  const handleSaveSessionClick = () => {
    if (!sessionName || sessionName === '') {
      toast({ message: 'Session name must not be empty!' });
    } else
    if (sessionName === '___config') {
      toast({ message: 'Invalid session name!' });
    } else {
      if (localStorage.hasOwnProperty(sessionName)) {
        toast({ message: 'Saved current session to "' + sessionName + '".' });
      } else {
        toast({ message: 'Chat session "' + sessionName + '" is created!' });
      }
      localStorage.setItem(sessionName, JSON.stringify({ data: chatHistory, modified: getTimestamp() }));
      // Reload session list
      helperReloadSessionList();
      //
      setShowSaveSessionModal(false);
    }
  };

  const handleSaveChatHistory = chatHistory => {
    webuiCall().call('chat_history_plaintext_save', chatHistory).then(() => {
      onReload();
    });
  };

  const handleDeleteSessionClick = session => () => {
    localStorage.removeItem(session);
    toast({ message: 'Chat session "' + session + '" deleted!' });
    helperReloadSessionList();
  };

  const handleShowSaveSessionModalClick = () => {
    setSessionName(`${getTimestamp()} - chat`);
    setShowSaveSessionModal(true);
  };

  const handleHideSaveSessionModalClick = () => {
    setShowSaveSessionModal(false);
  };

  const handleReplaceSessionClick = sessionName => () => {
    localStorage.setItem(sessionName, JSON.stringify({ data: chatHistory, modified: getTimestamp() }));
    toast({ message: 'Saved current session to "' + sessionName + '".' });
  };

  const handleLoadSessionClick = sessionName => () => {
    const text = JSON.parse(localStorage.getItem(sessionName)).data;
    handleSaveChatHistory(text);
    toast({ message: 'Chat session "' + sessionName + '" loaded!' });
  };

  const handleSessionNameChange = e => {
    setSessionName(e.target.value);
  };

  const renderSessionList = () => {
    return e('table', { style: { width: '100%' } }, sessionList.length === 0 ? e('span', { className: 'text' }, 'No chat session') : sessionList.map(session => {
      return e('tr', {}, [
        e('td', { className: 'text' }, session),
        e('td', { style: { width: '102px' } }, [
          e('button', { className: 'btn btn-sm btn-outline-success me-1', title: 'Replace "' + session + '" session with current one', onClick: handleReplaceSessionClick(session) }, e('i', { className: 'fa fa-solid fa-upload' })),
          e('button', { className: 'btn btn-sm btn-outline-primary me-1', title: 'Load "' + session + '" session', onClick: handleLoadSessionClick(session) }, e('i', { className: 'fa fa-solid fa-download' })),
          e('button', { className: 'btn btn-sm btn-outline-danger', title: 'Delete "' + session + '" session', onClick: handleDeleteSessionClick(session) }, e('i', { className: 'fa fa-solid fa-trash' })),
        ]),
      ]);
    }));
  }

  return [
    e(Modal, {
      visible: showSaveSessionModal,
      title: 'Save chat session',
      body: [
        'This will save the current chat session to web browser\'s local storage, which can be retrieved later in session manager.',
        e('br'),
        'If a session with the same name already exists, it will be replaced with the current one.',
        e('br'),
        e('br'),
        'Enter the name for this session:',
        e('br'),
        e('input', { className: 'form-control', placeholder: 'Session name', value: sessionName, onChange: handleSessionNameChange }),
      ],
      footer: [
        e('button', { className: 'btn btn-primary', onClick: handleSaveSessionClick }, [
          e('i', { className: 'fa fa-solid fa-save me-2' }),
          'Save',
        ]),
        e('button', { className: 'btn btn-secondary', onClick: handleHideSaveSessionModalClick }, [
          e('i', { className: 'fa fa-solid fa-times me-2' }),
          'Close',
        ]),
      ]
    }),
    e('div', { className: 'sidebar-left' }, [
      e('div', { className: 'sidebar-left-session-container' }, renderSessionList()),
      [
        e('button', { className: 'btn btn-success btn-sm w-100', type: 'button', title: 'Save current chat session to local storage', onClick: handleShowSaveSessionModalClick }, [
          e('i', { className: 'fa fa-solid fa-upload me-2' }),
          'Save current session'
        ]),
        e('button', { className: 'btn btn-info btn-sm w-100', type: 'button', title: 'Close', onClick: onClose },
          e('i', { className: 'fa fa-solid fa-arrow-left' }),
        ),
      ],
    ]),
  ];
}

/**
 * Right sidebar
 */
const SideBarRight = ({
  onClose,
}) => {
  const configWolframAlphaDefaultValues = {
    apiKey: '3EHTP4-QYU8LR5KE2',
  };
  const configChatGPTDefaultValues = {
    apiKey: '<YOUR SECRET KEY>',
  };
  const configOobaboogaDefaultValues = {
    max_tokens: 8192,
    temperature: 0.65,
    frequency_penalty: 0,
    presence_penalty: 0,
    top_p: 0.7,
    server: 'http://localhost:5000',
  };
  const configKoboldcppDefaultValues = {
    max_length: 8192,
    rep_pen: 1.18,
    temperature: 0.65,
    dynatemp_range: 0,
    top_p: 0.7,
    top_k: 50,
    top_a: 0,
    rep_pen_range: 1024,
    rep_pen_slope: 0.7,
    typical: 1,
    tfs: 1,
    server: 'http://localhost:5001',
  };
  const [serviceType, setServiceType] = useState(null);
  const [configValues, setConfigValues] = useState({});
  const updateRef = useRef(null);

  useEffect(() => {
    webuiCall().call('chat_service_type_get').then(serviceType => {
      setServiceType(serviceType);
      switch (serviceType) {
        case 'koboldcpp':
          setConfigValues(configKoboldcppDefaultValues);
          break;
        case 'oobabooga':
          setConfigValues(configOobaboogaDefaultValues);
          break;
        case 'chatgpt':
          setConfigValues(configChatGPTDefaultValues);
          break;
        case 'wolframalpha':
          setConfigValues(configWolframAlphaDefaultValues);
          break;
      }
      webuiCall().call('chat_service_settings_get').then(res => {
        if (res !== '') {
          setConfigValues(JSON.parse(res));
        }
      });
    });
  }, []);

  useEffect(() => {
    clearTimeout(updateRef.current);
    updateRef.current = setTimeout(() => {
      switch (serviceType) {
        case 'koboldcpp':
          webuiCall().call('chat_service_settings_set', JSON.stringify(configValues));
          break;
        case 'oobabooga':
          webuiCall().call('chat_service_settings_set', JSON.stringify({ server: configValues.server }));
          break;
        case 'chatgpt':
        case 'wolframalpha':
          webuiCall().call('chat_service_settings_set', JSON.stringify({ apiKey: configValues.apiKey }));
          break;
      }
    }, 500);
  }, [configValues.rep_pen, configValues.temperature, configValues.dynatemp_range, configValues.top_p, configValues.top_a, configValues.top_k,
      configValues.rep_pen_range, configValues.rep_pen_slope, configValues.typical, configValues.tfs, configValues.server,
      configValues.apiKey]);

  handleConfigFloatValueChange = field => e => {
    setConfigValues({
      ...configValues,
      [field]: parseFloat(e.target.value),
    });
  }

  handleConfigIntValueChange = field => e => {
    setConfigValues({
      ...configValues,
      [field]: parseInt(e.target.value),
    });
  }

  handleConfigStringValueChange = field => e => {
    setConfigValues({
      ...configValues,
      [field]: e.target.value,
    });
  }

  handleResetValues = () => {
    switch (serviceType) {
      case 'koboldcpp':
        let newValues = { ...configKoboldcppDefaultValues, server: configValues.server };
        setConfigValues(newValues);
        break;
      case 'oobabooga':
        newValues = { ...configOobaboogaDefaultValues, server: configValues.server };
        setConfigValues(newValues);
        break;
      case 'chatgpt':
        newValues = { ...configChatGPTDefaultValues, apiKey: configValues.apiKey };
        setConfigValues(newValues);
        break;
      case 'wolframalpha':
        newValues = { ...configWolframAlphaDefaultValues, apiKey: configValues.apiKey };
        setConfigValues(newValues);
        break;
    }
  }

  const renderSliderItem = (label, value, min, max, step, onChange) => {
    return e('tr', { className: 'text' }, [
        e('td', {},
          label,
        ),
        e('td', {},
          e('input', { className: 'form-range', type: 'range', value, min, max, step, onChange }),
        ),
        e('td', { className: 'w-20' },
          e('input', { className: 'w-100', type: 'number', value, step, onChange }),
        ),
      ]
    );
  }

  const renderInputItem = (label, value, onChange) => {
    return e('tr', { className: 'text' }, [
        e('td', {},
          label,
        ),
        e('td', { colspan: 2 },
          e('input', { className: 'w-100', type: 'text', value, onChange }),
        ),
      ]
    );
  }

  const renderKoboldCppConfigs = e('div', {}, [
    e('h4', { className: 'w-100 text-center' }, 'koboldcpp'),
    e('table', { className: 'sidebar-right-slider-container' }, [
      renderSliderItem('Max. Length', configValues.max_length, 1, 32768, 1, handleConfigIntValueChange('max_length')),
      renderSliderItem('Rep. Penalty', configValues.rep_pen, 1, 3, 0.01, handleConfigFloatValueChange('rep_pen')),
      renderSliderItem('Temperature', configValues.temperature, 0.0, 2, 0.01, handleConfigFloatValueChange('temperature')),
      renderSliderItem('DynaTemp', configValues.dynatemp_range, 0.0, 2, 0.01, handleConfigFloatValueChange('dynatemp_range')),
      renderSliderItem('Top p', configValues.top_p, 0, 2, 0.01, handleConfigFloatValueChange('top_p')),
      renderSliderItem('Top k', configValues.top_k, 0, 300, 1, handleConfigFloatValueChange('top_k')),
      renderSliderItem('Top a', configValues.top_a, 0, 100, 0.01, handleConfigFloatValueChange('top_a')),
      renderSliderItem('Rep. Penalty Range', configValues.rep_pen_range, 0, 4096, 1, handleConfigFloatValueChange('rep_pen_range')),
      renderSliderItem('Rep. Penalty Slope', configValues.rep_pen_slope, 0, 1, 0.01, handleConfigFloatValueChange('rep_pen_slope')),
      renderSliderItem('Typical', configValues.typical, 0, 1, 0.01, handleConfigFloatValueChange('typical')),
      renderSliderItem('tfs', configValues.tfs, 0, 1, 0.01, handleConfigFloatValueChange('tfs')),
      renderInputItem('Server', configValues.server, handleConfigStringValueChange('server')),
    ]),
    e('button', { className: 'btn btn-secondary btn-sm mt-2 w-100', type: 'button', onClick: handleResetValues },
      'Reset values'
    ),
  ]);

  const renderOobaboogaConfigs = e('div', {}, [
    e('h4', { className: 'w-100 text-center' }, 'oobabooga'),
    e('table', { className: 'sidebar-right-slider-container' }, [
      renderSliderItem('Max. Tokens', configValues.max_tokens, 1, 32768, 1, handleConfigIntValueChange('max_tokens')),
      renderSliderItem('Temperature', configValues.temperature, 0.0, 2, 0.01, handleConfigFloatValueChange('temperature')),
      renderSliderItem('DynaTemp', configValues.dynatemp_range, 0.0, 2, 0.01, handleConfigFloatValueChange('dynatemp_range')),
      renderSliderItem('Frequency Penalty', configValues.frequency_penalty, -2, 2, 0, handleConfigFloatValueChange('frequency_penalty')),
      renderSliderItem('Presence Penalty', configValues.presence_penalty, -2, 2, 0, handleConfigFloatValueChange('presence_penalty')),
      renderSliderItem('Top p', configValues.top_p, 0, 2, 0.01, handleConfigFloatValueChange('top_p')),
      renderInputItem('Server', configValues.server, handleConfigStringValueChange('server')),
    ]),
    e('button', { className: 'btn btn-secondary btn-sm mt-2 w-100', type: 'button', onClick: handleResetValues },
      'Reset values'
    ),
  ]);

  const renderWolframAlphaConfigs = e('div', {}, [
    e('h4', { className: 'w-100 text-center' }, 'WolframAlpha'),
    e('table', { className: 'sidebar-right-slider-container' }, [
      renderInputItem('API Key', configValues.apiKey, handleConfigStringValueChange('apiKey')),
    ]),
    e('button', { className: 'btn btn-secondary btn-sm mt-2 w-100', type: 'button', onClick: handleResetValues },
      'Reset values'
    ),
  ]);

  const renderChatGPTConfigs = e('div', {}, [
    e('h4', { className: 'w-100 text-center' }, 'ChatGPT'),
    e('table', { className: 'sidebar-right-slider-container' }, [
      renderInputItem('API Key', configValues.apiKey, handleConfigStringValueChange('apiKey')),
    ]),
    e('button', { className: 'btn btn-secondary btn-sm mt-2 w-100', type: 'button', onClick: handleResetValues },
      'Reset values'
    ),
  ]);

  const renderConfigs = () => {
    switch (serviceType) {
      case 'koboldcpp':
        return renderKoboldCppConfigs;
      case 'oobabooga':
        return renderOobaboogaConfigs;
      case 'wolframalpha':
        return renderWolframAlphaConfigs;
      case 'chatgpt':
        return renderChatGPTConfigs;
      default:
        return e('div');
    }
  };

  return e('div', { className: 'sidebar-right' }, [
    renderConfigs(),
    e('button', { className: 'btn btn-info btn-sm', type: 'button', title: 'Close', onClick: onClose },
      e('i', { className: 'fa fa-solid fa-arrow-right' }),
    ),
  ]);
}

/**
 * Chat UI
 * @param {function} props.onEditModeChange Edit mode change callback.
 * @param {boolean} props.firstTime True if the app start running in less than 1s
 * @returns {Component}
 */
const Chat = ({
  onEditModeChange,
  firstTime,
}) => {
  const [refresh, setRefresh] = useState(0);
  const [page, setPage] = useState(0);
  const [isPaging, setIsPaging] = useState(false);
  const [chatHistory, setChatHistory] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [serviceValue, setServiceValue] = useState('0');
  const [serviceList, setServiceList] = useState(['None']);
  const [character, setCharacter] = useState({});
  const [typing, setTyping] = useState(false);
  const [theme, setTheme] = useTheme();
  const [showSidebarRight, setShowSidebarRight] = useState(false);
  const [showSidebarLeft, setShowSidebarLeft] = useState(false);
  const messagesRef = useRef(null);

  const handleGetInitInfos = () => {
    Promise.all([
      webuiCall().call('character_skin_get', ''),
      webuiCall().call('character_name_get', ''),
      webuiCall().call('chat_service_list_get', ''),
      webuiCall().call('chat_service_get', ''),
    ]).then(ress => {
      setCharacter({
        skin: ress[0],
        name: ress[1],
      });
      setServiceList(['None', ...ress[2].split(';').filter(a => a !== '')]);
      setServiceValue(ress[3]);
    });
    //
    webuiCall().call('chat_history_get', '').then(res => {
      setChatHistory(JSON.parse(res));
    });
    webuiCall().call('chat_is_streaming', '').then(res => {
      setTyping(res !== '0');
    });
  };

  useEffect(() => {
    chatItemComponentCache = {};
    if (!firstTime) {
      handleGetInitInfos();
    } else {
      setTimeout(() => {
        Promise.all([
          webuiCall().call('character_skin_get', ''),
          webuiCall().call('character_name_get', ''),
          webuiCall().call('chat_service_list_get', ''),
          webuiCall().call('chat_service_get', ''),
        ]).then(ress => {
          setCharacter({
            skin: ress[0],
            name: ress[1],
          });
          setServiceList(['None', ...ress[2].split(';').filter(a => a !== '')]);
          setServiceValue(ress[3]);
          document.title = 'Chat with ' + ress[1] + '!';
        });
      }, 1000);
    }
  }, []);

  useEffect(() => {
    // Request for chat history
    const interval = setTimeout(() => {
      webuiCall().call('chat_history_get', '').then(res => {
        setChatHistory(JSON.parse(res));
      });
      webuiCall().call('chat_is_streaming', '').then(res => {
        setTyping(res !== '0');
        setRefresh(refresh + 1);
      });
    }, 1000);
    return () => clearTimeout(interval);
  }, [refresh]);

  helperConvertChatHistoryToPlainText = chatHistory => {
    // Convert chat history to plain text version
    let chatHistoryPlainText = '';
    chatHistory.forEach(item => {
      // Do not get the system messages
      if (item.kind !== 0) {
        chatHistoryPlainText += `${item.name}: ${item.message}\n`;
      }
    });
    return chatHistoryPlainText;
  };

  handleServiceChange = e => {
    const v = `${e.target.value}`;
    webuiCall().call('chat_service_set', v).then(() => {
      setServiceValue(v);
    });
  };

  handleThemeChange = e => {
    setTheme(e.target.value);
  };

  handleStopGeneratingClick = () => {
    webuiCall().call('chat_stop_generating', '').then(() => {
      setTyping(false);
    });
  };

  handleRefreshServiceListClick = () => {
    webuiCall().call('chat_service_list_get', '').then(res => {
      setServiceList(['None', ...res.split(';').filter(a => a !== '')]);
    });
  };

  handleRetryLastMessageClick = () => {
    // Delete the latest generated messages by satania
    let chatItem = chatHistory.pop();
    while (chatItem && chatItem.kind === 0) {
      chatItem = chatHistory.pop();
    }
    // Convert chat history to plain text version
    let chatHistoryPlainText = helperConvertChatHistoryToPlainText(chatHistory);
    // Save this new version of chat history
    webuiCall().call('chat_history_plaintext_save', chatHistoryPlainText).then(() => {
      webuiCall().call('chat_history_get', '').then(res => {
        setChatHistory(JSON.parse(res));
        webuiCall().call('chat_send', '/blank');
      });
    });
  };

  handleContinueLastMessageClick = () => {
    webuiCall().call('chat_send', '/blank');
  };

  handleSingleMessageChange = item => {
    // Find and replace message by guid
    for (let i = 0; i < chatHistory.length; i += 1) {
      const chatItem = chatHistory[i];
      if (chatItem.guid === item.guid) {
        chatItem.message = item.message;
        break;
      }
    }
    // Convert chat history to plain text version
    let chatHistoryPlainText = helperConvertChatHistoryToPlainText(chatHistory);
    // Save this new version of chat history
    webuiCall().call('chat_history_plaintext_save', chatHistoryPlainText).then(() => {
      webuiCall().call('chat_history_get', '').then(res => {
        setChatHistory(JSON.parse(res));
      });
    });
  };

  handleSingleMessageDelete = item => {
    // Find and delete message by guid
    const newChatHistory = chatHistory.filter(a => a.guid !== item.guid);
    // Convert chat history to plain text version
    let chatHistoryPlainText = helperConvertChatHistoryToPlainText(newChatHistory);
    // Save this new version of chat history
    webuiCall().call('chat_history_plaintext_save', chatHistoryPlainText).then(() => {
      webuiCall().call('chat_history_get', '').then(res => {
        setChatHistory(JSON.parse(res));
      });
    });
  };

  handleReload = () => {
    webuiCall().call('chat_history_get', '').then(res => {
      setChatHistory(JSON.parse(res));
    });
  }

  renderChatMessages = () => {
    let result = null;
    if (isPaging) {
      result = [];
      for (let i = Math.max(0, chatHistory.length - CHAT_DISPLAY * (page + 1)); i < chatHistory.length - CHAT_DISPLAY * page; i += 1) {
        result.push(e(ChatItem, {
          ...chatHistory[i],
          key: chatHistory[i].guid,
          onMessageChange: handleSingleMessageChange,
          onMessageDelete: handleSingleMessageDelete,
          onRenderChange: () => setTimeout(() => messagesRef.current.scrollTop = messagesRef.current.scrollHeight, 100),
        }));
      }
    } else {
      result = [
        ...chatHistory.map(item => (e(ChatItem, {
          ...item,
          onMessageChange: handleSingleMessageChange,
          onMessageDelete: handleSingleMessageDelete,
          onRenderChange: () => setTimeout(() => messagesRef.current.scrollTop = messagesRef.current.scrollHeight, 100),
        })))
      ];
    }
    if (typing) {
      result.push(e('div', { className: 'chat-item-container' }, [
        e('div', { className: 'chat-item-avatar-container', style: { visibility: 'hidden' } } ),
        e('div', { className: 'chat-item-text-container' },
          e('div', {}, e('em', { className: 'chat-item-text-typing' }, [
            `${character.name} is typing...`,
            e('button', { className: 'btn btn-danger btn-sm ms-2', title: 'Stop generating', type: 'button', onClick: handleStopGeneratingClick },
              e('i', { className: 'fa fa-solid fa-stop' }),
            ),
          ])),
        ),
      ]));
    }
    return result;
  };

  renderPaging = () => {
    if (!isPaging) {
      return null;
    }
    result = [];
    const numberOfPages = Math.floor(Math.max(0, chatHistory.length - 1) / CHAT_DISPLAY) + 1;

    if (numberOfPages > 1) {
      result.push(e('div', { className: 'fa fa-angle-double-left pointer', style: { visibility: !(page > 0) && 'hidden' }, title: 'First page', onClick: () => setPage(0) }));
      result.push(e('div', { className: 'fa fa-angle-left pointer', style: { visibility: !(page > 0) && 'hidden' }, title: 'Previous', onClick: () => setPage(page - 1) }));
      result.push(e('div', {}, `${page + 1} / ${numberOfPages}`));
      result.push(e('div', { className: 'fa fa-angle-right pointer', style: { visibility: !(page < numberOfPages - 1) && 'hidden' }, title: 'Next', onClick: () => setPage(page + 1) }));
      result.push(e('div', { className: 'fa fa-angle-double-right pointer', style: { visibility: !(page < numberOfPages - 1) && 'hidden' }, title: 'Last page', onClick: () => setPage(numberOfPages - 1) }));
    }

    return result;
  };

  renderChatInput = () => {
    handleChatInputChange = e => {
      setChatInput(e.target.value);
    };
    handleChatInputKeyDown = e => {
      if ((e.key === 'Enter' || e.keyCode === 13) && !e.shiftKey) {
        e.stopPropagation();
        e.preventDefault();
        webuiCall().call('chat_send', chatInput);
        setChatInput('');
        messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
      }
    };
    return e('textarea', {
      className: 'chat-input',
      readOnly: typing,
      value: chatInput,
      placeholder: 'Type your message here...',
      onChange: handleChatInputChange,
      onKeyDown: handleChatInputKeyDown,
    });
  };

  renderLayout = () => {
    return e('div', { className: 'chat-container' }, [
      e('div', { className: 'd-flex flex-column w-100 chat-messages-container', ref: messagesRef }, renderChatMessages()),
      e('div', { className: 'w-100 chat-paging-container' }, renderPaging()),
      e('div', { className: 'w-100 chat-input-container' }, renderChatInput()),
    ]);
  };

  if (!chatHistory) {
    return e(Loading);
  }
  return e('div', { className: 'app-container' }, [
    e('div', { className: 'app-content' }, [
      showSidebarLeft && e(SideBarLeft, {
        chatHistory: helperConvertChatHistoryToPlainText(chatHistory),
        onClose: () => setShowSidebarLeft(false),
        onReload: handleReload,
      }),
      e('div', { className: 'app-content-sub' }, renderLayout()),
      showSidebarRight && e(SideBarRight, { onClose: () => setShowSidebarRight(false) }),
    ]),
    e('div', { className: 'app-commands' }, [
      e('div', { className: 'app-commands-left' }, [
        e('button', { className: 'btn btn-secondary btn-sm me-2', type: 'button', title: 'Show left sidebar', onClick: () => setShowSidebarLeft(!showSidebarLeft) },
          e('i', { className: 'fa fa-solid fa-bars' }),
        ),
        e('select', { className: 'me-2', value: theme, onChange: handleThemeChange }, Themes.map(item => {
          return e('option', { value: item.value }, item.key);
        })),
        [
          e('input', { className: 'me-2', id: 'is-paging', type: 'checkbox', checked: isPaging, onChange: () => setIsPaging(!isPaging) }),
          e('label', { style: { color: 'var(--color-text)' }, for: 'is-paging', title: 'Enable / Disable pagination (20 messages / page)' }, 'Pagination'),
        ],
      ]),
      e('div', { className: 'app-commands-right' }, [
        e('select', { className: 'me-2', value: serviceValue, disabled: typing, onChange: handleServiceChange }, serviceList.map((item, index) => {
          return e('option', { value: `${index}` }, item);
        })),
        e('button', { className: 'btn btn-secondary btn-sm me-2', type: 'button', title: 'Edit this service in Evil script editor', onClick: () => webuiCall().call('chat_service_edit', '') },
          e('i', { className: 'fa fa-solid fa-code' }),
        ),
        e('button', { className: 'btn btn-secondary btn-sm me-5', type: 'button', title: 'Refresh list of services', onClick: handleRefreshServiceListClick, },
          e('i', { className: 'fa fa-solid fa-refresh' }),
        ),
        e('button', { className: 'btn btn-primary btn-sm me-2', type: 'button', title: 'Continue to generate from last message', onClick: handleContinueLastMessageClick, disabled: typing },
          e('i', { className: 'fa fa-solid fa-arrow-up' }),
        ),
        e('button', { className: 'btn btn-success btn-sm me-2', type: 'button', title: 'Re-generate the last message', onClick: handleRetryLastMessageClick, disabled: typing },
          e('i', { className: 'fa fa-solid fa-repeat' }),
        ),
        e('button', { className: 'btn btn-info btn-sm me-2', type: 'button', title: 'Edit chat in plain text', onClick: () => onEditModeChange(EditMode.HISTORY), disabled: typing },
          e('i', { className: 'fa fa-solid fa-book' }),
        ),
        e('button', { className: 'btn btn-secondary btn-sm me-2', type: 'button', title: 'Show right sidebar', onClick: () => setShowSidebarRight(!showSidebarRight) },
          e('i', { className: 'fa fa-solid fa-bars' }),
        ),
      ]),
    ]),
  ]);
};

const App = () => {
  const [editMode, setEditMode] = useState(EditMode.CHAT);
  const [firstTime, setFirstTime] = useState(true);

  useEffect(() => {
    // Wait an reasonable amount of time to make sure websocket is established.
    setTimeout(() => {
      setFirstTime(false);
    }, 1000);
  }, []);

  let renderContent = null;
  if (editMode === EditMode.HISTORY) {
    renderContent = e(HistoryEditor, { onEditModeChange: setEditMode });
  } else {
    renderContent = e(Chat, { onEditModeChange: setEditMode, firstTime });
  }

  return [
    e(Toast),
    renderContent,
  ];
};

ReactDOM.render(e(App), document.querySelector('#react'));