import { useState, useEffect } from 'react'
import './index.css'

// Suggestion cache (module-level so it persists across renders)
const suggestionCache = new Map();

// Reusable Autocomplete Input Component (defined outside App for stable identity)
const AutocompleteInput = ({ value, onChange, placeholder, onSelect, style, name, required }) => {
  const [localSuggestions, setLocalSuggestions] = useState([]);
  const [localIsTyping, setLocalIsTyping] = useState(false);
  const [localShow, setLocalShow] = useState(false);

  useEffect(() => {
    if (value.length < 2) {
      setLocalSuggestions([]);
      return;
    }

    const cacheKey = value.trim().toLowerCase();

    // Instant cache hit — no network needed
    if (suggestionCache.has(cacheKey)) {
      setLocalSuggestions(suggestionCache.get(cacheKey));
      return;
    }

    const abortController = new AbortController();

    const fetchSuggestions = async () => {
      setLocalIsTyping(true);
      try {
        const res = await fetch(
          `https://openlibrary.org/search.json?q=${encodeURIComponent(value)}&limit=5&fields=title,author_name,key`,
          { signal: abortController.signal }
        );
        const data = await res.json();
        const docs = data.docs.map(doc => ({
          title: doc.title,
          author: doc.author_name ? doc.author_name[0] : 'Unknown Author',
          key: doc.key
        }));
        suggestionCache.set(cacheKey, docs);
        setLocalSuggestions(docs);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error("Failed to fetch suggestions", error);
        }
      } finally {
        setLocalIsTyping(false);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 250);

    return () => {
      clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [value]);

  return (
    <div style={{ position: 'relative', flexGrow: 1 }}>
      <input
        type="text"
        name={name}
        placeholder={placeholder}
        value={value}
        required={required}
        onChange={(e) => {
          onChange(e.target.value);
          setLocalShow(true);
        }}
        onFocus={() => setLocalShow(true)}
        onBlur={() => setTimeout(() => setLocalShow(false), 250)}
        style={{ ...style, width: '100%', marginBottom: '0' }}
      />
      {localShow && (localSuggestions.length > 0 || localIsTyping) && (
        <div className="suggestions-dropdown">
          {localIsTyping && <div className="suggestion-item loading">Searching...</div>}
          {localSuggestions.map((s, i) => (
            <div
              key={`${s.key}-${i}`}
              className="suggestion-item"
              onClick={() => {
                onSelect(s);
                setLocalShow(false);
              }}
            >
              <div className="suggestion-title">{s.title}</div>
              <div className="suggestion-author">by {s.author}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    return localStorage.getItem('bw_user') || null;
  });

  const [currentView, setCurrentView] = useState(() => {
    return localStorage.getItem('bw_user') ? 'home' : 'auth';
  });

  const [readingBook, setReadingBook] = useState(null);

  const [authMode, setAuthMode] = useState('login'); // login, signup
  const [searchQuery, setSearchQuery] = useState('');
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookAuthor, setNewBookAuthor] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showTopRankings, setShowTopRankings] = useState(false);
  const [newBookReview, setNewBookReview] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);

  // User database state
  const [users, setUsers] = useState(() => {
    const saved = localStorage.getItem('bw_users');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  // App State - Load from persistence
  const [books, setBooks] = useState(() => {
    const saved = localStorage.getItem('bw_books');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('bw_notifications');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  // Save books to storage whenever they change
  useEffect(() => {
    localStorage.setItem('bw_books', JSON.stringify(books));
  }, [books]);

  // Save users to storage
  useEffect(() => {
    localStorage.setItem('bw_users', JSON.stringify(users));
  }, [users]);

  // Save user session
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('bw_user', currentUser);
    } else {
      localStorage.removeItem('bw_user');
      if (currentView !== 'auth') {
        setCurrentView('auth');
      }
    }
  }, [currentUser, currentView]);

  const handleDeleteAccount = () => {
    if (window.confirm("ARE YOU SURE? This will completely delete your account and all your data forever!")) {
      // Remove current user from users list
      setUsers(prev => prev.filter(u => u.username !== currentUser));
      
      // Clear session
      localStorage.removeItem('bw_user');
      setCurrentUser(null);
      setCurrentView('auth');
      alert("Account Deleted Successfully.");
    }
  };

  const handleDeleteBook = (bookId) => {
    const book = books.find(b => b.id === bookId);
    if (!book) return;
    
    // Security: only the person who recommended it can delete it
    if (book.recommender !== currentUser) {
      alert("You can only delete your own recommendations!");
      return;
    }

    if (window.confirm("Are you sure you want to delete this recommendation?")) {
      setBooks(prev => prev.filter(b => b.id !== bookId));
    }
  };

  // Chat State
  const [chatMessages, setChatMessages] = useState(() => {
    const saved = localStorage.getItem('bw_chat');
    return saved ? JSON.parse(saved) : [
      { id: 1, user: 'System', text: 'Welcome to the Bookers Chat! Discuss your favorite reads or ask for recommendations here.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ];
  });
  const [newChatMessage, setNewChatMessage] = useState('');

  // Save chat to storage
  useEffect(() => {
    localStorage.setItem('bw_chat', JSON.stringify(chatMessages));
  }, [chatMessages]);

  // Sync state across tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'bw_books') {
        setBooks(JSON.parse(e.newValue || '[]'));
      }
      if (e.key === 'bw_chat') {
        setChatMessages(JSON.parse(e.newValue || '[]'));
      }
      if (e.key === 'bw_notifications') {
        setNotifications(JSON.parse(e.newValue || '[]'));
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Save notifications to storage
  useEffect(() => {
    localStorage.setItem('bw_notifications', JSON.stringify(notifications));
  }, [notifications]);

  const handleUpdateRecommendationStatus = (msgId, status) => {
    setChatMessages(prev => prev.map(msg => 
      msg.id === msgId ? { ...msg, recommendationStatus: status } : msg
    ));
  };

  // Helper function to fetch real cover from Open Library API
  const fetchRealCover = async (title) => {
    try {
      const formattedTitle = encodeURIComponent(title);
      const res = await fetch(`https://openlibrary.org/search.json?title=${formattedTitle}&limit=5`);
      const data = await res.json();

      if (data.docs && data.docs.length > 0) {
        for (let doc of data.docs) {
          if (doc.cover_i) {
            return `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
          }
        }
      }
      return null;
    } catch (error) {
      console.error("Failed to fetch cover", error);
      return null;
    }
  };

  // Simulated Database for the 3 External Library Systems (Now Dynamic)
  const [dynamicLibraryResults, setDynamicLibraryResults] = useState([]);
  const [librarySearchPage, setLibrarySearchPage] = useState(1);
  const [hasMoreResults, setHasMoreResults] = useState(false);

  const [curatedRows, setCuratedRows] = useState([]);
  const [isLoadingCurated, setIsLoadingCurated] = useState(false);

  useEffect(() => {
    const fetchCurated = async () => {
      setIsLoadingCurated(true);
      try {
        const categories = [
          { title: "Graphic Novels", query: 'author:"Dav Pilkey"' },
          { title: "Diary of a Wimpy Kid", query: 'author:"Jeff Kinney"' },
          { title: "Big Nate Comics", query: 'author:"Lincoln Peirce"' },
          { title: "Baby-Sitters Club", query: 'author:"Ann M. Martin"' }
        ];

        const fetchPromises = categories.map(async (cat) => {
          const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(cat.query)}%20has_fulltext:true&limit=8&fields=title,author_name,cover_i,key,ia`);
          const data = await res.json();
          const books = (data.docs || []).map(doc => ({
            id: doc.key,
            title: doc.title,
            author: doc.author_name ? doc.author_name[0] : 'Unknown',
            coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
            iaId: doc.ia && doc.ia.length > 0 ? doc.ia[0] : null,
            key: doc.key,
            available: !!(doc.ia && doc.ia.length > 0)
          })).filter(b => b.iaId);
          return { title: cat.title, books };
        });

        const results = await Promise.all(fetchPromises);
        setCuratedRows(results);
      } catch (e) {
        console.error("Failed fetching curated", e);
      } finally {
        setIsLoadingCurated(false);
      }
    };
    fetchCurated();
  }, []);

  const [isSearchingLib, setIsSearchingLib] = useState(false);

  // Generate mock results when searching the external library systems
  const handleLibrarySearch = async (e, isLoadMore = false, suggestedQuery = null) => {
    if (e) e.preventDefault();
    setShowSuggestions(false);

    const query = suggestedQuery || librarySearchQuery;
    if (suggestedQuery) setLibrarySearchQuery(suggestedQuery);

    if (query.trim() === '') {
      setDynamicLibraryResults([]);
      setHasMoreResults(false);
      return;
    }

    setIsSearchingLib(true);

    const targetPage = isLoadMore ? librarySearchPage + 1 : 1;
    if (!isLoadMore) {
      setDynamicLibraryResults([]);
    }

    try {
      const formattedQuery = encodeURIComponent(`${query} has_fulltext:true`);
      const res = await fetch(`https://openlibrary.org/search.json?q=${formattedQuery}&limit=12&page=${targetPage}&fields=title,author_name,cover_i,key,ia,has_fulltext`);
      const data = await res.json();

      const systems = ['City Public Library', 'School Library', 'County Library Network'];

      const results = (data.docs || []).map((doc, idx) => {
        const coverUrl = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null;
        const iaId = doc.ia && doc.ia.length > 0 ? doc.ia[0] : null;

        return {
          id: `${doc.key}-${targetPage}` || `id-${Date.now()}-${idx}`,
          title: doc.title || query,
          author: doc.author_name ? doc.author_name[0] : 'Unknown Author',
          system: systems[idx % 3],
          available: true,
          coverUrl: coverUrl,
          key: doc.key,
          iaId: iaId
        };
      });

      const validResults = results.filter(r => r.title && r.iaId);

      if (isLoadMore) {
        setDynamicLibraryResults(prev => [...prev, ...validResults]);
      } else {
        setDynamicLibraryResults(validResults);
      }

      setLibrarySearchPage(targetPage);
      setHasMoreResults(validResults.length === 12);

    } catch (error) {
      console.error("Library Search error", error);
      if (!isLoadMore) setDynamicLibraryResults([]);
      setHasMoreResults(false);
    }

    setIsSearchingLib(false);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const username = e.target[0].value;
    const password = e.target[1].value;

    if (authMode === 'signup') {
      const existingUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());
      if (existingUser) {
        alert("This username is already taken! Please choose another or login.");
        return;
      }
      
      const newUser = { username, password };
      setUsers(prev => [...prev, newUser]);
      setCurrentUser(username);
      setCurrentView('home');
      alert(`Welcome to Bookers, ${username}! Your account has been created.`);
    } else {
      const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
      if (user) {
        setCurrentUser(user.username);
        setCurrentView('home');
      } else {
        alert("Invalid username or password. If you don't have an account, please Sign Up first!");
      }
    }
  };

  const [isLoadingReader, setIsLoadingReader] = useState(false);

  const openReader = async (book) => {
    if (!book.available) return;

    if (book.iaId) {
      setReadingBook(book);
      setCurrentView('reader');
      return;
    }

    setIsLoadingReader(true);
    try {
      const formattedTitle = encodeURIComponent(book.title);
      const res = await fetch(`https://openlibrary.org/search.json?title=${formattedTitle}&has_fulltext=true&limit=5&fields=ia,key,cover_i`);
      const data = await res.json();

      let foundIaId = null;
      let foundKey = null;
      let foundCover = null;

      if (data.docs) {
        for (let doc of data.docs) {
          if (doc.ia && doc.ia.length > 0) {
            foundIaId = doc.ia[0];
            foundKey = doc.key;
            if (doc.cover_i) {
              foundCover = `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
            }
            break;
          }
        }
      }

      if (foundIaId) {
        const updatedBook = {
          ...book,
          iaId: foundIaId,
          key: foundKey || book.key,
          coverUrl: book.coverUrl || foundCover
        };
        // cache in state so we don't re-fetch
        setBooks(prevBooks => prevBooks.map(b => b.id === book.id ? updatedBook : b));
        setReadingBook(updatedBook);
        setCurrentView('reader');
      } else {
        alert("Sorry, a free digital scan of this book is not currently available in the archive.");
      }
    } catch (error) {
      console.error("Failed to load reader", error);
      alert("Error checking for digital copy.");
    } finally {
      setIsLoadingReader(false);
    }
  };

  const handleBorrowRequest = (bookId) => {
    const book = books.find(b => b.id === bookId);
    if (book && book.available) {
      const newNotif = {
        id: Date.now(),
        from: currentUser,
        to: book.recommender,
        type: 'borrow',
        bookTitle: book.title,
        bookId: book.id,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'pending'
      };
      setNotifications([...notifications, newNotif]);
      alert(`Request Sent!\n\nWe've sent a notification to ${book.recommender} to let them know you'd like to borrow '${book.title}'. Check the chat for their response!`);
      setBooks(books.map(b => b.id === bookId ? { ...b, available: false } : b));
    }
  };

  const handleHandleNotification = (notifId, action) => {
    const notif = notifications.find(n => n.id === notifId);
    if (!notif) return;

    if (action === 'approve') {
      const msg = {
        id: Date.now(),
        user: 'System',
        text: `📖 ${currentUser} approved ${notif.from}'s request to borrow '${notif.bookTitle}'!`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages([...chatMessages, msg]);
    } else {
      // If declined, make book available again
      setBooks(books.map(b => b.id === notif.bookId ? { ...b, available: true } : b));
    }

    setNotifications(notifications.filter(n => n.id !== notifId));
  };

  const handleLibraryReserve = (book) => {
    setReadingBook(book);
    setCurrentView('reader');

    // Update the UI to show it's currently checked out by the user
    setDynamicLibraryResults(dynamicLibraryResults.map(b => b.id === book.id ? { ...b, available: false } : b));
  };

  const handleLibraryHold = (bookTitle) => {
    alert(`Hold Placed!\n\nYou have been added to the waitlist for '${bookTitle}'. We will email you when it becomes available in the network.`);
  };

  const handleDiscoverBorrow = (bookTitle) => {
    alert(`Library Match Found!\n\nWe found a copy of '${bookTitle}' in the network. A request has been initiated.`);
  };

  const [isAddingBook, setIsAddingBook] = useState(false);

  const handleAddBook = async (e) => {
    e.preventDefault();
    const title = newBookTitle;
    const author = newBookAuthor;
    const review = newBookReview;

    if (!review.trim()) {
      alert("Please write a short review! Others need to know why they should read this book.");
      return;
    }

    setIsAddingBook(true);

    // Fetch real cover directly from Open Library API!
    const realCoverUrl = await fetchRealCover(title);

    const newBook = {
      id: Date.now(),
      title,
      author,
      review,
      coverUrl: realCoverUrl,
      recommender: currentUser,
      available: true,
      thumbsUp: Math.floor(Math.random() * 20) + 1 // mock initial popularity
    };

    setBooks([newBook, ...books]);
    setNewBookTitle('');
    setNewBookAuthor('');
    setNewBookReview('');
    setIsAddingBook(false);
    setCurrentView('home');
  };

  const sortedBooks = [...books].sort((a, b) => b.thumbsUp - a.thumbsUp);
  const topBooks = sortedBooks.slice(0, 3);

  const TopNav = () => (
    <div className="nav-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          className={currentView === 'home' ? 'btn-primary text-theme-primary' : 'btn-secondary'}
          style={currentView === 'home' ? { borderColor: 'var(--theme-primary)', boxShadow: '0 0 10px var(--theme-primary)' } : {}}
          onClick={() => setCurrentView('home')}
        >
          Recommendation & Lend
        </button>
        <button
          className={currentView === 'discover' ? 'btn-secondary text-theme-secondary' : 'btn-primary'}
          style={currentView === 'discover' ? { borderColor: 'var(--theme-secondary)', boxShadow: '0 0 10px var(--theme-secondary)' } : {}}
          onClick={() => setCurrentView('discover')}
        >
          Discover & Borrow
        </button>
        <button
          className={currentView === 'chat' ? 'btn-primary text-theme-primary' : 'btn-secondary'}
          style={currentView === 'chat' ? { borderColor: 'var(--theme-primary)', boxShadow: '0 0 10px var(--theme-primary)', marginLeft: '10px' } : { marginLeft: '10px' }}
          onClick={() => setCurrentView('chat')}
        >
          💬 Book Chat
        </button>
        <button
            className={currentView === 'settings' ? 'btn-primary text-theme-primary' : 'btn-secondary'}
            style={currentView === 'settings' ? { borderColor: '#555', boxShadow: '0 0 10px rgba(0,0,0,0.1)', marginLeft: '10px' } : { marginLeft: '10px' }}
            onClick={() => setCurrentView('settings')}
          >
            ⚙️ Settings
          </button>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <button 
              className="btn-secondary" 
              style={{ width: '40px', padding: '0', borderRadius: '50%', height: '40px', fontSize: '18px', borderColor: notifications.filter(n => n.to === currentUser).length > 0 ? 'var(--theme-primary)' : '#ccc' }}
              onClick={() => setShowNotifications(!showNotifications)}
            >
              🔔
              {notifications.filter(n => n.to === currentUser).length > 0 && (
                <span style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'red', color: 'white', borderRadius: '50%', width: '18px', height: '18px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {notifications.filter(n => n.to === currentUser).length}
                </span>
              )}
            </button>
            
            {showNotifications && (
              <div className="glass-panel" style={{ position: 'absolute', top: '50px', right: '0', width: '300px', zIndex: 100, padding: '15px' }}>
                <h4 style={{ margin: '0 0 15px 0' }}>Borrow Requests</h4>
                {notifications.filter(n => n.to === currentUser).length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#888' }}>No new requests.</p>
                ) : (
                  notifications.filter(n => n.to === currentUser).map(n => (
                    <div key={n.id} style={{ borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '10px' }}>
                      <p style={{ fontSize: '13px', margin: '0 0 10px 0' }}><strong>{n.from}</strong> wants to borrow <strong>{n.bookTitle}</strong></p>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button className="btn-primary" style={{ fontSize: '11px', padding: '5px' }} onClick={() => handleHandleNotification(n.id, 'approve')}>Approve</button>
                        <button className="btn-secondary" style={{ fontSize: '11px', padding: '5px' }} onClick={() => handleHandleNotification(n.id, 'decline')}>Decline</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <button
            className="btn-secondary"
            style={{ padding: '8px 15px', color: '#ff4444', borderColor: '#ff4444', fontSize: '14px', width: 'auto' }}
            onClick={() => {
              setCurrentUser(null);
            }}
          >
            Logout
          </button>
        </div>
    </div>
  );

  const CoverElement = ({ coverUrl, title }) => {
    const [imageError, setImageError] = useState(false);

    return (coverUrl && !imageError) ? (
      <img
        src={coverUrl}
        className="book-cover"
        alt={title}
        style={{ objectFit: 'cover' }}
        onError={() => setImageError(true)}
      />
    ) : (
      <div className="book-cover" style={{ backgroundColor: '#222', border: '1px solid #444', textAlign: 'center', padding: '10px', boxSizing: 'border-box' }}>
        <span style={{ color: 'var(--theme-secondary)', fontSize: '13px' }}>{title}</span>
        <div style={{ fontSize: '10px', color: '#666', marginTop: '10px' }}>Cover Unavailable</div>
      </div>
    );
  };

  return (
    <div style={{ padding: '20px', width: '100%' }}>

      {currentView === 'auth' && (
        <div className="glass-panel" style={{ marginTop: '10vh', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
          <h1 className="text-theme-primary">Bookers</h1>
          <h3 style={{ color: '#555', fontWeight: 'normal' }}>For 3rd-8th Graders</h3>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', marginTop: '30px' }}>
            <button
              style={{ background: authMode === 'login' ? 'var(--theme-secondary)' : 'transparent', color: 'white', border: '1px solid var(--theme-secondary)', borderRadius: '5px', padding: '8px' }}
              onClick={() => setAuthMode('login')}
            >Login</button>
            <button
              style={{ background: authMode === 'signup' ? 'var(--theme-primary)' : 'transparent', color: 'white', border: '1px solid var(--theme-primary)', borderRadius: '5px', padding: '8px' }}
              onClick={() => setAuthMode('signup')}
            >Sign Up</button>
          </div>

          <form onSubmit={handleLogin}>
            {authMode === 'signup' && (
              <input type="text" placeholder="Real Name (Username)" required />
            )}
            {authMode === 'login' && (
              <input type="text" placeholder="Username / Name" required />
            )}

            <input type="password" placeholder="Password" required />

            <button className={authMode === 'login' ? 'btn-secondary' : 'btn-primary'} type="submit">
              {authMode === 'login' ? 'Access Library' : 'Join Bookers!'}
            </button>
          </form>
        </div>
      )}

      {currentView !== 'auth' && <TopNav />}

      {currentView === 'home' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Peer Recommendations Section */}
          <div className="glass-panel text-center">
            <h2 className="text-theme-secondary">Book Recommendations</h2>
            <p style={{ color: '#aaa', marginBottom: '20px' }}>Welcome {currentUser}! Peer-curated for 3rd through 8th Grade</p>

            {!showTopRankings ? (
              <button 
                className="btn-secondary" 
                style={{ width: 'auto', padding: '10px 20px', marginBottom: '30px' }}
                onClick={() => setShowTopRankings(true)}
              >
                🏆 See Top 3 Rankings
              </button>
            ) : (
              <div style={{ marginBottom: '30px' }}>
                <h3 className="text-theme-primary">Top Ranked Books</h3>
                <div className="book-grid">
                  {topBooks
                    .filter(book => book.review) // Only show books with reviews
                    .map(book => (
                    <div key={`top-${book.id}`} className="book-card">
                      <CoverElement coverUrl={book.coverUrl} title={book.title} />
                      <div className="book-title">{book.title}</div>
                      <div className="book-author" style={{ marginBottom: '10px' }}>by {book.author}</div>

                      <div style={{ fontStyle: 'italic', fontSize: '12px', color: '#666', marginBottom: '10px', borderLeft: '3px solid var(--theme-primary)', paddingLeft: '8px' }}>
                        "{book.review}"
                      </div>

                      <div style={{
                        display: 'inline-block',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        color: book.available ? '#155724' : '#721c24',
                        backgroundColor: book.available ? '#d4edda' : '#f8d7da',
                        marginBottom: '10px',
                        border: `1px solid ${book.available ? '#c3e6cb' : '#f5c6cb'}`
                      }}>
                        {book.available ? '🟢 Available' : '🔴 Checked Out'}
                      </div>

                      <div style={{ fontSize: '11px', color: 'var(--theme-primary)' }}>Recommended by: {book.recommender}</div>
                      
                      {book.recommender === currentUser ? (
                        <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', gap: '5px' }}>
                            <button
                              onClick={() => setBooks(books.map(b => b.id === book.id ? { ...b, available: true } : b))}
                              style={{
                                padding: '6px', fontSize: '10px', background: book.available ? '#28a745' : 'transparent',
                                border: `1px solid ${book.available ? '#28a745' : '#ccc'}`,
                                color: book.available ? 'white' : '#999', borderRadius: '5px',
                                cursor: 'pointer', flex: 1, fontWeight: 'bold', marginBottom: '0'
                              }}>
                              Lendable
                            </button>
                            <button
                              onClick={() => setBooks(books.map(b => b.id === book.id ? { ...b, available: false } : b))}
                              style={{
                                padding: '6px', fontSize: '10px', background: !book.available ? '#dc3545' : 'transparent',
                                border: `1px solid ${!book.available ? '#dc3545' : '#ccc'}`,
                                color: !book.available ? 'white' : '#999', borderRadius: '5px',
                                cursor: 'pointer', flex: 1, fontWeight: 'bold', marginBottom: '0'
                              }}>
                              Not Lendable
                            </button>
                          </div>
                          <button 
                            onClick={() => handleDeleteBook(book.id)}
                            style={{ 
                              padding: '6px', fontSize: '10px', color: '#ff4444', border: '1px solid #ff4444', 
                              background: 'transparent', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold',
                              marginBottom: '0'
                            }}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleBorrowRequest(book.id)}
                          style={{
                            marginTop: '15px', padding: '8px', fontSize: '12px', background: 'transparent',
                            border: `1px solid ${book.available ? 'var(--theme-primary)' : '#ccc'}`,
                            color: book.available ? 'var(--theme-primary)' : '#999', borderRadius: '5px',
                            cursor: book.available ? 'pointer' : 'default', width: '100%',
                            fontWeight: 'bold', marginBottom: '0'
                          }}>
                          {book.available ? `Borrow from ${book.recommender}` : 'In Use'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button 
                  className="btn-secondary" 
                  style={{ width: 'auto', padding: '5px 15px', fontSize: '12px', marginTop: '10px' }}
                  onClick={() => setShowTopRankings(false)}
                >
                  Hide Rankings
                </button>
              </div>
            )}

            <div style={{ borderTop: '1px solid #eee', paddingTop: '30px' }}>
              <h3 className="text-theme-secondary">Recent Wall of Books</h3>
              {books.length === 0 ? (
                <div style={{ padding: '40px 20px', border: '2px dashed var(--theme-secondary)', borderRadius: '15px' }}>
                  <h3 className="text-theme-primary">No books here yet!</h3>
                  <p>Be the first Booker to recommend a book!</p>
                  <button className="btn-secondary" style={{ width: 'auto', padding: '10px 30px', marginTop: '20px' }} onClick={() => setCurrentView('add_book')}>
                    Recommend a Book
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ padding: '0 20px 20px', textAlign: 'center' }}>
                    <button 
                      className="btn-primary" 
                      style={{ width: 'auto', padding: '10px 30px', margin: '0 auto 20px' }} 
                      onClick={() => setCurrentView('add_book')}
                    >
                      + Recommend a Book
                    </button>
                  </div>
                  <div className="book-grid">
                  {books
                    .filter(book => book.review || book.recommender === currentUser) // Only show books with reviews (or your own)
                    .map(book => (
                    <div key={`all-${book.id}`} className="book-card">
                      <CoverElement coverUrl={book.coverUrl} title={book.title} />
                      <div className="book-title">{book.title}</div>
                      <div className="book-author" style={{ marginBottom: '10px' }}>by {book.author}</div>

                      {(book.review) && (
                        <div style={{ fontStyle: 'italic', fontSize: '12px', color: '#666', marginBottom: '10px', borderLeft: '3px solid var(--theme-secondary)', paddingLeft: '8px' }}>
                          "{book.review}"
                        </div>
                      )}
                      {!book.review && (
                        <div style={{ fontSize: '10px', color: '#ff4444', fontStyle: 'italic', marginBottom: '10px' }}>
                          (Review required to show publicly)
                        </div>
                      )}

                      <div style={{
                        display: 'inline-block',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        color: book.available ? '#155724' : '#721c24',
                        backgroundColor: book.available ? '#d4edda' : '#f8d7da',
                        marginBottom: '10px',
                        border: `1px solid ${book.available ? '#c3e6cb' : '#f5c6cb'}`
                      }}>
                        {book.available ? '🟢 Available' : '🔴 Checked Out'}
                      </div>

                      <div style={{ fontSize: '11px', color: 'var(--theme-primary)' }}>Recommended by: {book.recommender}</div>
                      
                      {book.recommender === currentUser ? (
                        <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', gap: '5px' }}>
                            <button
                              onClick={() => setBooks(books.map(b => b.id === book.id ? { ...b, available: true } : b))}
                              style={{
                                padding: '6px', fontSize: '10px', background: book.available ? '#28a745' : 'transparent',
                                border: `1px solid ${book.available ? '#28a745' : '#ccc'}`,
                                color: book.available ? 'white' : '#999', borderRadius: '5px',
                                cursor: 'pointer', flex: 1, fontWeight: 'bold', marginBottom: '0'
                              }}>
                              Lendable
                            </button>
                            <button
                              onClick={() => setBooks(books.map(b => b.id === book.id ? { ...b, available: false } : b))}
                              style={{
                                padding: '6px', fontSize: '10px', background: !book.available ? '#dc3545' : 'transparent',
                                border: `1px solid ${!book.available ? '#dc3545' : '#ccc'}`,
                                color: !book.available ? 'white' : '#999', borderRadius: '5px',
                                cursor: 'pointer', flex: 1, fontWeight: 'bold', marginBottom: '0'
                              }}>
                              Not Lendable
                            </button>
                          </div>
                          <button 
                            onClick={() => handleDeleteBook(book.id)}
                            style={{ 
                              padding: '6px', fontSize: '10px', color: '#ff4444', border: '1px solid #ff4444', 
                              background: 'transparent', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold',
                              marginBottom: '0'
                            }}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleBorrowRequest(book.id)}
                          style={{
                            marginTop: '15px', padding: '8px', fontSize: '12px', background: 'transparent',
                            border: `1px solid ${book.available ? 'var(--theme-primary)' : '#ccc'}`,
                            color: book.available ? 'var(--theme-primary)' : '#999', borderRadius: '5px',
                            cursor: book.available ? 'pointer' : 'default', width: '100%',
                            fontWeight: 'bold', marginBottom: '0'
                          }}>
                          {book.available ? `Borrow from ${book.recommender}` : 'In Use'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                </>
              )}
            </div>
          </div>

          {/* External Libraries Search Section */}
          <div className="glass-panel text-center">
            <h2 className="text-theme-primary">Search Linked Libraries</h2>
            <p style={{ color: '#aaa', marginBottom: '20px' }}>Search across City, County, and School Library Systems</p>

            <form onSubmit={handleLibrarySearch}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <AutocompleteInput
                  placeholder="🔍 Search for a book title or author..."
                  value={librarySearchQuery}
                  onChange={(val) => setLibrarySearchQuery(val)}
                  onSelect={(s) => handleLibrarySearch(null, false, s.title)}
                  style={{ borderColor: 'var(--theme-primary)' }}
                />
                <button type="submit" className="btn-primary" style={{ width: 'auto', marginBottom: '0' }} disabled={isSearchingLib}>
                  Search
                </button>
              </div>
            </form>

            {isSearchingLib && <p style={{ color: 'var(--theme-secondary)' }}>Searching global library databases...</p>}

            {librarySearchQuery && (
              <div className="book-grid">
                {dynamicLibraryResults.map(book => (
                  <div key={`lib-${book.id}`} className="book-card">
                    <CoverElement coverUrl={book.coverUrl} title={book.title} />
                    <div className="book-title" style={{ textTransform: 'capitalize' }}>{book.title}</div>
                    <div className="book-author" style={{ marginBottom: '10px' }}>by {book.author}</div>

                    <div style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      color: book.available ? '#155724' : '#721c24',
                      backgroundColor: book.available ? '#d4edda' : '#f8d7da',
                      marginBottom: '10px',
                      border: `1px solid ${book.available ? '#c3e6cb' : '#f5c6cb'}`
                    }}>
                      {book.available ? '🟢 Available' : '🔴 Unavailable'}
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--theme-secondary)', fontWeight: 'bold' }}>{book.system}</div>
                    <button
                      onClick={() => book.available ? handleLibraryReserve(book) : handleLibraryHold(book.title)}
                      style={{
                        marginTop: '15px', padding: '8px', fontSize: '12px', background: 'transparent',
                        border: `1px solid ${book.available ? 'var(--theme-secondary)' : '#999'}`,
                        color: book.available ? 'var(--theme-secondary)' : '#666', borderRadius: '5px',
                        cursor: 'pointer', width: '100%',
                        fontWeight: 'bold'
                      }}
                    >
                      {book.available ? 'Read Now' : 'Place on Hold'}
                    </button>
                  </div>
                ))}

                {dynamicLibraryResults.length > 0 && hasMoreResults && (
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
                    <button
                      className="btn-secondary"
                      style={{ width: '200px' }}
                      onClick={() => handleLibrarySearch(null, true)}
                      disabled={isSearchingLib}
                    >
                      {isSearchingLib ? 'Loading...' : 'See More Books'}
                    </button>
                  </div>
                )}

                {dynamicLibraryResults.length === 0 && !isSearchingLib && (
                  <p style={{ color: '#aaa', width: '100%' }}>No books found.</p>
                )}
              </div>
            )}
          </div>

        </div>
      )}

      {currentView === 'home' && (
        <div className="glass-panel" style={{ marginTop: '20px' }}>
          <h2 className="text-theme-primary text-center">Browse Collections</h2>
          <p style={{ color: '#aaa', marginBottom: '30px', textAlign: 'center' }}>Explore curated collections of instantly available digital books</p>

          {isLoadingCurated ? (
            <div style={{ textAlign: 'center', color: '#aaa', padding: '20px' }}>Loading collections...</div>
          ) : (
            curatedRows.map((row, idx) => (
              <div key={idx} style={{ marginBottom: '40px' }}>
                <h3 style={{ borderBottom: '2px solid var(--theme-secondary)', display: 'inline-block', paddingBottom: '5px', marginBottom: '20px', color: '#fff' }}>{row.title}</h3>
                <div style={{ display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '15px' }} className="hide-scroll">
                  {row.books.map(book => (
                    <div key={book.id} style={{ minWidth: '150px', maxWidth: '150px', cursor: 'pointer', textAlign: 'center' }} onClick={() => openReader(book)}>
                      <CoverElement coverUrl={book.coverUrl} title={book.title} />
                      <div style={{ fontSize: '13px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '10px' }}>{book.title}</div>
                      <div style={{ fontSize: '11px', color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>by {book.author}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {currentView === 'discover' && (
        <div className="glass-panel">
          <h2 className="text-theme-primary">Discover & Borrow</h2>
          <p style={{ color: '#aaa', marginBottom: '20px', textAlign: 'center' }}>Community Rankings by Student Reviews</p>

          <div style={{ marginBottom: '30px' }}>
            <AutocompleteInput
              placeholder="🔍 Search for a book or author in the local ranking..."
              value={searchQuery}
              onChange={(val) => setSearchQuery(val)}
              onSelect={(s) => setSearchQuery(s.title)}
            />
          </div>

          {books.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#aaa' }}>The library is currently empty. Add a book to see it ranked here!</div>
          ) : (
            <div className="rank-list">
              {sortedBooks
                .filter(book =>
                  book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  book.author.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((book, idx) => (
                  <div key={book.id} className="rank-item">
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#555', width: '30px' }}>#{idx + 1}</div>

                    {book.coverUrl ? (
                      <img src={book.coverUrl} className="rank-thumb" alt={book.title} style={{ objectFit: 'cover' }} />
                    ) : (
                      <div className="rank-thumb" style={{ border: '1px solid #444', backgroundColor: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                        <span style={{ fontSize: '9px', color: 'var(--theme-primary)', padding: '2px' }}>{book.title}</span>
                      </div>
                    )}

                    <div className="rank-details">
                      <div className="book-title" style={{ fontSize: '18px' }}>{book.title}</div>
                      <div className="book-author">by {book.author}</div>
                      <div className="rank-stats" style={{ marginTop: '5px' }}>{book.thumbsUp} Thumbs Up</div>
                    </div>
                    <div>
                      {book.recommender === currentUser ? (
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button
                            onClick={() => setBooks(books.map(b => b.id === book.id ? { ...b, available: true } : b))}
                            style={{
                              padding: '8px 12px', fontSize: '11px', background: book.available ? '#28a745' : 'transparent',
                              border: `1px solid ${book.available ? '#28a745' : '#ccc'}`,
                              color: book.available ? 'white' : '#999', borderRadius: '5px',
                              cursor: 'pointer', fontWeight: 'bold', marginBottom: '0', width: 'auto'
                            }}>
                            Lendable
                          </button>
                          <button
                            onClick={() => setBooks(books.map(b => b.id === book.id ? { ...b, available: false } : b))}
                            style={{
                              padding: '8px 12px', fontSize: '11px', background: !book.available ? '#dc3545' : 'transparent',
                              border: `1px solid ${!book.available ? '#dc3545' : '#ccc'}`,
                              color: !book.available ? 'white' : '#999', borderRadius: '5px',
                              cursor: 'pointer', fontWeight: 'bold', marginBottom: '0', width: 'auto'
                            }}>
                            Not Lendable
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleBorrowRequest(book.id)}
                          className="btn-secondary"
                          style={{ padding: '10px 20px', fontSize: '14px', marginBottom: '0' }}
                          disabled={!book.available}
                        >
                          {book.available ? `Borrow from ${book.recommender}` : 'Currently Borrowed'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {currentView === 'add_book' && (
        <form className="glass-panel" onSubmit={handleAddBook} style={{ maxWidth: '400px', margin: '0 auto' }}>
            <h2 className="text-theme-secondary">Recommend a Book</h2>
            <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '25px' }}>Add a 3rd-8th grade book you want to lend to others!</p>

            <div style={{ marginBottom: '15px', textAlign: 'left' }}>
              <label style={{ fontSize: '13px', color: '#555', marginBottom: '5px', display: 'block' }}>Book Title</label>
              <input
                type="text"
                placeholder="Full Title"
                value={newBookTitle}
                onChange={(e) => setNewBookTitle(e.target.value)}
                required
                style={{ marginBottom: '0' }}
              />
            </div>

            <div style={{ marginBottom: '15px', textAlign: 'left' }}>
              <label style={{ fontSize: '13px', color: '#555', marginBottom: '5px', display: 'block' }}>Author</label>
              <input
                type="text"
                placeholder="Author Name"
                value={newBookAuthor}
                onChange={(e) => setNewBookAuthor(e.target.value)}
                required
                style={{ marginBottom: '0' }}
              />
            </div>

            <div style={{ marginBottom: '25px', textAlign: 'left' }}>
              <label style={{ fontSize: '13px', color: '#555', marginBottom: '5px', display: 'block' }}>✍️ Why should others read this?</label>
              <textarea
                placeholder="Write a short review..."
                value={newBookReview}
                onChange={(e) => setNewBookReview(e.target.value)}
                required
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  borderRadius: '10px', 
                  border: '1px solid #ddd',
                  height: '100px',
                  fontFamily: 'inherit',
                  fontSize: '14px'
                }}
              />
            </div>

            <button type="submit" className="btn-primary" disabled={isAddingBook}>
              {isAddingBook ? 'Searching for Book Cover...' : 'Add Recommendation'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ marginTop: '10px' }}
              onClick={() => {
                setCurrentView('home');
                setNewBookTitle('');
                setNewBookAuthor('');
                setNewBookReview('');
              }}
            >
              Cancel
            </button>
          </form>
      )}

      {currentView === 'chat' && (
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '600px', maxWidth: '800px', margin: '0 auto' }}>
          <h2 className="text-theme-primary" style={{ borderBottom: '1px solid #333', paddingBottom: '15px', marginBottom: '20px' }}>Bookers Chat</h2>

          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px', paddingRight: '10px' }} className="hide-scroll">
            {chatMessages.map(msg => (
              <div key={msg.id} style={{ marginBottom: '15px', display: 'flex', flexDirection: 'column', alignItems: msg.user === currentUser ? 'flex-end' : 'flex-start' }}>
                <div style={{ fontSize: '12px', color: '#999', marginBottom: '5px' }}>
                  {msg.user} <span style={{ fontSize: '10px' }}>• {msg.time}</span>
                </div>
                <div style={{
                  padding: '10px 15px',
                  borderRadius: '15px',
                  backgroundColor: msg.user === currentUser ? 'var(--theme-primary)' : '#2a2a2a',
                  color: msg.user === currentUser ? '#000' : '#fff',
                  maxWidth: '75%',
                  wordWrap: 'break-word',
                  fontWeight: msg.user === currentUser ? '500' : 'normal',
                  position: 'relative'
                }}>
                  {msg.text}
                  
                  {msg.isRecommendation && (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${msg.user === currentUser ? 'rgba(0,0,0,0.1)' : '#444'}`, width: '100%' }}>
                      {msg.recommendationStatus === 'pending' ? (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button 
                            onClick={() => handleUpdateRecommendationStatus(msg.id, 'lendable')}
                            style={{ padding: '4px 8px', fontSize: '11px', width: 'auto', marginBottom: '0', background: '#28a745', color: 'white' }}
                          >
                            Lendable
                          </button>
                          <button 
                            onClick={() => handleUpdateRecommendationStatus(msg.id, 'not-lendable')}
                            style={{ padding: '4px 8px', fontSize: '11px', width: 'auto', marginBottom: '0', background: '#dc3545', color: 'white' }}
                          >
                            Not Lendable
                          </button>
                        </div>
                      ) : (
                        <div style={{ 
                          fontSize: '11px', 
                          fontWeight: 'bold', 
                          color: msg.recommendationStatus === 'lendable' ? '#28a745' : '#dc3545',
                          backgroundColor: msg.user === currentUser ? 'rgba(255,255,255,0.2)' : '#1a1a1a',
                          padding: '3px 8px',
                          borderRadius: '10px',
                          display: 'inline-block'
                        }}>
                          Status: {msg.recommendationStatus === 'lendable' ? 'Lendable' : 'Not Lendable'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <form
            style={{ display: 'flex', gap: '10px', marginTop: 'auto', borderTop: '1px solid #333', paddingTop: '20px' }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!newChatMessage.trim()) return;

              const lowerText = newChatMessage.toLowerCase();
              const isRec = lowerText.includes('recommend') || lowerText.includes('book') || lowerText.includes('check out');
              
              const newMsg = {
                id: Date.now(),
                user: currentUser,
                text: newChatMessage,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isRecommendation: isRec,
                recommendationStatus: isRec ? 'pending' : null
              };
              setChatMessages([...chatMessages, newMsg]);
              setNewChatMessage('');
            }}
          >
            <input
              type="text"
              placeholder="Ask for a recommendation or talk about a book..."
              value={newChatMessage}
              onChange={(e) => setNewChatMessage(e.target.value)}
              style={{ flex: 1, marginBottom: '0', borderRadius: '20px' }}
            />
            <button type="submit" className="btn-primary" style={{ width: 'auto', borderRadius: '20px', paddingInline: '20px', marginBottom: '0' }} disabled={!newChatMessage.trim()}>
              Send
            </button>
          </form>
        </div>
      )}

      {currentView === 'settings' && (
        <div className="glass-panel" style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
          <h2 className="text-theme-primary">Settings</h2>
          <p style={{ color: '#aaa', marginBottom: '30px' }}>Manage your Bookers account</p>
          
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '18px', color: '#fff' }}>Profile</h3>
            <p style={{ color: '#aaa' }}>Loged in as: <strong>{currentUser}</strong></p>
          </div>

          <div style={{ borderTop: '1px solid #333', paddingTop: '30px' }}>
            <h3 style={{ fontSize: '18px', color: '#fff' }}>Troubleshooting</h3>
            <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px' }}>If you don't see recommendations from another tab:</p>
            <ul style={{ fontSize: '12px', color: '#888', textAlign: 'left', marginBottom: '20px' }}>
              <li>Make sure both tabs use the <strong>exact same address</strong> (e.g., both are http://localhost:5174).</li>
              <li>Don't use <strong>Incognito</strong> or different browsers (e.g., Chrome vs Edge), as they don't share data.</li>
              <li>Try the button below to force a data update.</li>
            </ul>
            <button 
              className="btn-secondary" 
              onClick={() => {
                const b = localStorage.getItem('bw_books');
                const c = localStorage.getItem('bw_chat');
                if (b) setBooks(JSON.parse(b));
                if (c) setChatMessages(JSON.parse(c));
                alert("Data Refreshed from Storage!");
              }}
            >
              🔄 Refresh Data from Storage
            </button>
          </div>

          <div style={{ borderTop: '1px solid #333', marginTop: '30px', paddingTop: '30px' }}>
            <h3 style={{ fontSize: '18px', color: '#ff4444' }}>Danger Zone</h3>
            <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px' }}>Deleting your account will remove all your recommendations and chat history. This cannot be undone.</p>
            <button 
              className="btn-secondary" 
              style={{ color: '#ff4444', borderColor: '#ff4444' }}
              onClick={handleDeleteAccount}
            >
              🗑️ Permanently Delete Account
            </button>
          </div>
          
          <button 
            className="btn-primary" 
            style={{ marginTop: '20px' }}
            onClick={() => setCurrentView('home')}
          >
            Done
          </button>
        </div>
      )}

      {currentView === 'reader' && readingBook && (
        <div className="glass-panel" style={{ backgroundColor: 'white' }}>
          <button className="btn-secondary" style={{ width: 'auto', marginBottom: '20px' }} onClick={() => setCurrentView('home')}>
            ← Back to Library
          </button>
          <div style={{ display: 'flex', gap: '40px', marginTop: '10px' }}>
            <div style={{ minWidth: '150px' }}>
              <CoverElement coverUrl={readingBook.coverUrl} title={readingBook.title} />
              <h3 style={{ marginTop: '15px', fontSize: '18px' }} className="text-theme-primary">{readingBook.title}</h3>
              <p style={{ color: 'var(--text-light)', textAlign: 'center', fontSize: '14px' }}>by {readingBook.author}</p>

              {readingBook.iaId && (
                <a
                  href={`https://archive.org/details/${readingBook.iaId}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    marginTop: '25px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    padding: '12px 15px',
                    borderRadius: '5px',
                    fontWeight: 'bold',
                    textDecoration: 'none',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                  }}
                >
                  🔓 Borrow & Read Full Book <br /><span style={{ fontSize: '12px', fontWeight: 'normal' }}>(Opens New Tab on Internet Archive)</span>
                </a>
              )}
            </div>

            <div style={{ flex: 1, padding: '0 20px', borderLeft: '2px dashed var(--surface-border)' }}>
              <div style={{
                backgroundColor: '#e8f4fd',
                color: '#004085',
                padding: '12px',
                borderRadius: '5px',
                marginBottom: '15px',
                fontSize: '14px',
                border: '1px solid #b8daff',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                lineHeight: '1.4'
              }}>
                <span style={{ fontSize: '24px' }}>ℹ️</span>
                <div>
                  <strong>Seeing a "Limited Preview" message?</strong> Because this is a copyrighted book, you need to click the <strong>"Borrow for 1 hour"</strong> button. <br /><br />
                  <em>If that button is missing from the top of the reader</em>, your web browser is blocking it for security. Don't worry! Just click the big green <strong>"Borrow & Read Full Book"</strong> button on the left to securely open the full book in a new tab.
                </div>
              </div>

              {readingBook.iaId && (
                <iframe
                  src={`https://archive.org/embed/${readingBook.iaId}?ui=embed`}
                  width="100%"
                  height="600"
                  frameBorder="0"
                  allowFullScreen
                  title={`Read ${readingBook.title}`}
                  style={{ borderRadius: '8px', border: '1px solid var(--surface-border)' }}
                />
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default App
