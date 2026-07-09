import { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  addDoc,
  getDocs,
} from 'firebase/firestore';
import './App.css';

const ADMIN_PASSWORD = 'battlehub123';

// ---------- Firebase config ----------
// Yahan apna Firebase project ka config daalo (Firebase Console -> Project Settings -> Your apps)
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const tournamentsCol = collection(db, 'tournaments');
const registrationsCol = collection(db, 'registrations');

const DEFAULT_TOURNAMENTS = [
  { id: '1', name: 'Sunday Solo Clash', mode: 'Solo', entryFee: 80, prizePool: 12000, perKillReward: 50, date: 'Sun, 6 Jul', time: '8 PM', status: 'Open', image: null },
  { id: '2', name: 'Miramar Duo Rush', mode: 'Duo', entryFee: 120, prizePool: 20000, perKillReward: 60, date: 'Mon, 7 Jul', time: '9 PM', status: 'Open', image: null },
  { id: '3', name: 'Sanhok Squad Series', mode: 'Squad', entryFee: 200, prizePool: 50000, perKillReward: 100, date: 'Wed, 9 Jul', time: '9 PM', status: 'Closed', image: null },
];

const EMPTY_FORM = { name: '', mode: 'Solo', entryFee: '', prizePool: '', perKillReward: '', date: '', time: '', status: 'Open', image: null };

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalTournament, setModalTournament] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [regForm, setRegForm] = useState({ pubgName: '', pubgUid: '', whatsapp: '', screenshot: null });

  const [tournaments, setTournaments] = useState([]);
  const [loadingTournaments, setLoadingTournaments] = useState(true);

  // Real-time listener - tournaments collection mein jo bhi change ho, turant reflect hoga
  useEffect(() => {
    const unsub = onSnapshot(
      tournamentsCol,
      async (snapshot) => {
        if (snapshot.empty) {
          // Collection khali hai - defaults se initialize karo
          for (const t of DEFAULT_TOURNAMENTS) {
            await setDoc(doc(db, 'tournaments', t.id), t);
          }
          // onSnapshot khud dobara chal jayega jab data add hoga
        } else {
          const list = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
          setTournaments(list);
          setLoadingTournaments(false);
        }
      },
      (err) => {
        console.error('Tournaments listener error:', err);
        alert('Tournaments load nahi ho rahe.\n\nWajah: ' + err.message);
        setLoadingTournaments(false);
      }
    );
    return () => unsub();
  }, []);

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminView, setAdminView] = useState('tournaments');
  const [adminForm, setAdminForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [roomDetails, setRoomDetails] = useState({});

  async function loadRegistrations() {
    try {
      const snap = await getDocs(registrationsCol);
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      list.sort((a, b) => b.submittedAtMs - a.submittedAtMs);
      setRegistrations(list);
    } catch (err) {
      console.error('Failed to load registrations:', err);
      alert('Registrations load nahi hui.\n\nWajah: ' + err.message);
    }
  }

  async function updateRegistrationStatus(id, status) {
    try {
      await updateDoc(doc(db, 'registrations', id), { status });
      setRegistrations(prev => prev.map(r => (r.id === id ? { ...r, status } : r)));
    } catch (err) {
      console.error('Failed to update registration status:', err);
      alert('Status update save nahi hua.\n\nWajah: ' + err.message);
    }
  }

  async function deleteRegistration(id) {
    if (window.confirm('Is registration ko delete karna hai?')) {
      try {
        await deleteDoc(doc(db, 'registrations', id));
        setRegistrations(prev => prev.filter(r => r.id !== id));
      } catch (err) {
        console.error('Failed to delete registration:', err);
        alert('Delete save nahi hua.\n\nWajah: ' + err.message);
      }
    }
  }

  function handleRoomDetailChange(id, field, value) {
    setRoomDetails(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  function formatWhatsAppNumber(number) {
    let digits = number.replace(/\D/g, '');
    if (digits.startsWith('0')) digits = '92' + digits.slice(1);
    if (!digits.startsWith('92')) digits = '92' + digits;
    return digits;
  }

  function sendRoomDetails(reg) {
    const details = roomDetails[reg.id] || {};
    if (!details.roomId || !details.roomPass) {
      alert('Pehle Room ID aur Password daalein.');
      return;
    }
    const phone = formatWhatsAppNumber(reg.whatsapp);
    const message = `Assalam o Alaikum ${reg.pubgName}!\n\nAapki registration "${reg.tournament}" tournament ke liye approve ho gayi hai.\n\nRoom ID: ${details.roomId}\nPassword: ${details.roomPass}\n\nMatch 10 minute mein start hone wala hai, jaldi lobby mein pohanch jayein. Good luck!\n- BattleHub`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  }

  function openAdmin() {
    const pass = window.prompt('Admin password:');
    if (pass === ADMIN_PASSWORD) {
      setIsAdmin(true);
      loadRegistrations();
    } else if (pass !== null) {
      alert('Galat password!');
    }
  }

  function startAddTournament() {
    setAdminForm(EMPTY_FORM);
    setEditingId('new');
  }

  function startEditTournament(t) {
    setAdminForm({ name: t.name, mode: t.mode, entryFee: t.entryFee, prizePool: t.prizePool, perKillReward: t.perKillReward || '', date: t.date, time: t.time, status: t.status, image: t.image || null });
    setEditingId(t.id);
  }

  function cancelAdminForm() {
    setEditingId(null);
    setAdminForm(EMPTY_FORM);
  }

  function handleAdminChange(e) {
    const { name, value } = e.target;
    setAdminForm(prev => ({ ...prev, [name]: value }));
  }

  function handleAdminImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setAdminForm(prev => ({ ...prev, image: reader.result }));
    };
    reader.readAsDataURL(file);
  }

  async function handleAdminSubmit(e) {
    e.preventDefault();
    try {
      if (editingId === 'new') {
        const newTournament = {
          name: adminForm.name,
          mode: adminForm.mode,
          entryFee: Number(adminForm.entryFee),
          prizePool: Number(adminForm.prizePool),
          perKillReward: Number(adminForm.perKillReward) || 0,
          date: adminForm.date,
          time: adminForm.time,
          status: adminForm.status,
          image: adminForm.image || null,
        };
        await addDoc(tournamentsCol, newTournament);
      } else {
        await updateDoc(doc(db, 'tournaments', editingId), {
          name: adminForm.name,
          mode: adminForm.mode,
          entryFee: Number(adminForm.entryFee),
          prizePool: Number(adminForm.prizePool),
          perKillReward: Number(adminForm.perKillReward) || 0,
          date: adminForm.date,
          time: adminForm.time,
          status: adminForm.status,
          image: adminForm.image || null,
        });
      }
      cancelAdminForm();
    } catch (err) {
      console.error('Failed to save tournament:', err);
      alert('Tournament save nahi hua.\n\nWajah: ' + err.message);
    }
  }

  async function deleteTournament(id) {
    if (window.confirm('Is tournament ko delete karna hai?')) {
      try {
        await deleteDoc(doc(db, 'tournaments', id));
      } catch (err) {
        console.error('Failed to delete tournament:', err);
        alert('Delete save nahi hua.\n\nWajah: ' + err.message);
      }
    }
  }

  function openModal(tournament) {
    setRegForm({ pubgName: '', pubgUid: '', whatsapp: '', screenshot: null });
    setSubmitted(false);
    setModalTournament(tournament);
  }

  function closeModal() {
    setModalTournament(null);
  }

  function handleRegChange(e) {
    const { name, value } = e.target;
    setRegForm(prev => ({ ...prev, [name]: value }));
  }

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setRegForm(prev => ({ ...prev, screenshot: reader.result }));
    };
    reader.readAsDataURL(file);
  }

  async function handleRegSubmit(e) {
    e.preventDefault();
    const registration = {
      tournament: modalTournament.name,
      entryFee: modalTournament.entryFee,
      pubgName: regForm.pubgName,
      pubgUid: regForm.pubgUid,
      whatsapp: regForm.whatsapp,
      screenshot: regForm.screenshot,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      submittedAtMs: Date.now(),
    };
    try {
      await addDoc(registrationsCol, registration);
      setSubmitted(true);
    } catch (err) {
      console.error('Failed to save registration:', err);
      alert('Registration save nahi hui.\n\nWajah: ' + err.message);
    }
  }

  if (isAdmin) {
    return (
      <div className="admin-page">
        <div className="admin-header">
          <div className="logo"><span className="dot"></span>BATTLE<span className="logo-hub">HUB</span> <span className="admin-tag">ADMIN</span></div>
          <button className="btn btn-ghost" onClick={() => setIsAdmin(false)}>Back to Site</button>
        </div>

        <div className="admin-tabs">
          <button className={`admin-tab ${adminView === 'tournaments' ? 'active' : ''}`} onClick={() => setAdminView('tournaments')}>Tournaments</button>
          <button className={`admin-tab ${adminView === 'registrations' ? 'active' : ''}`} onClick={() => { setAdminView('registrations'); loadRegistrations(); }}>Registrations {registrations.filter(r => r.status === 'pending').length > 0 && `(${registrations.filter(r => r.status === 'pending').length})`}</button>
        </div>

        {adminView === 'tournaments' && (
        <div className="admin-body">
          <div className="admin-top-row">
            <h2>Manage Tournaments</h2>
            {editingId === null && (
              <button className="btn btn-primary" onClick={startAddTournament}>+ Naya Tournament Add Karo</button>
            )}
          </div>

          {editingId !== null && (
            <form className="admin-form" onSubmit={handleAdminSubmit}>
              <h3>{editingId === 'new' ? 'New Tournament' : 'Edit Tournament'}</h3>
              <label>Tournament Name
                <input type="text" name="name" value={adminForm.name} onChange={handleAdminChange} required />
              </label>
              <label>Mode
                <select name="mode" value={adminForm.mode} onChange={handleAdminChange}>
                  <option value="Solo">Solo</option>
                  <option value="Duo">Duo</option>
                  <option value="Squad">Squad</option>
                </select>
              </label>
              <label>Entry Fee (Rs)
                <input type="number" name="entryFee" value={adminForm.entryFee} onChange={handleAdminChange} required />
              </label>
              <label>Prize Pool (Rs)
                <input type="number" name="prizePool" value={adminForm.prizePool} onChange={handleAdminChange} required />
              </label>
              <label>Per Kill Reward (Rs)
                <input type="number" name="perKillReward" value={adminForm.perKillReward} onChange={handleAdminChange} placeholder="e.g. 50" />
              </label>
              <label>Date (e.g. Sun, 6 Jul)
                <input type="text" name="date" value={adminForm.date} onChange={handleAdminChange} required />
              </label>
              <label>Time (e.g. 8 PM)
                <input type="text" name="time" value={adminForm.time} onChange={handleAdminChange} required />
              </label>
              <label>Status
                <select name="status" value={adminForm.status} onChange={handleAdminChange}>
                  <option value="Open">Open</option>
                  <option value="Closed">Closed</option>
                </select>
              </label>
              <label>Tournament Banner Image
                <input type="file" accept="image/*" onChange={handleAdminImage} />
              </label>
              {adminForm.image && (
                <img src={adminForm.image} alt="Banner preview" className="admin-image-preview" />
              )}
              <div className="admin-form-actions">
                <button type="submit" className="btn btn-primary">Save</button>
                <button type="button" className="btn btn-ghost" onClick={cancelAdminForm}>Cancel</button>
              </div>
            </form>
          )}

          <div className="admin-list">
            {loadingTournaments && <p className="featured-sub">Tournaments load ho rahe hain...</p>}
            {!loadingTournaments && tournaments.length === 0 && <p className="featured-sub">Koi tournament nahi hai. Upar se naya add karo.</p>}
            {tournaments.map(t => (
              <div className="admin-row" key={t.id}>
                <div className="admin-row-info">
                  {t.image && <img src={t.image} alt="" className="admin-row-thumb" />}
                  <span className={`status-tag ${t.status === 'Open' ? 'status-open' : 'status-closed'}`}>{t.status}</span>
                  <div>
                    <h4>{t.name}</h4>
                    <p className="admin-row-meta">{t.mode} - Entry Rs{t.entryFee} - Prize Rs{t.prizePool} - Per Kill Rs{t.perKillReward || 0} - {t.date} - {t.time}</p>
                  </div>
                </div>
                <div className="admin-row-actions">
                  <button className="btn btn-ghost" onClick={() => startEditTournament(t)}>Edit</button>
                  <button className="btn btn-delete" onClick={() => deleteTournament(t.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        )}

        {adminView === 'registrations' && (
        <div className="admin-body">
          <div className="admin-top-row">
            <h2>Player Registrations</h2>
          </div>

          {registrations.length === 0 && <p className="featured-sub">Abhi tak koi registration nahi aayi.</p>}

          <div className="reg-list">
            {registrations.map(reg => (
              <div className="reg-card" key={reg.id}>
                <div className="reg-card-top">
                  <div>
                    <h4>{reg.pubgName} <span className="reg-uid">(UID: {reg.pubgUid})</span></h4>
                    <p className="admin-row-meta">{reg.tournament} - Rs{reg.entryFee} - {reg.whatsapp}</p>
                  </div>
                  <span className={`status-tag ${reg.status === 'approved' ? 'status-open' : reg.status === 'rejected' ? 'status-closed' : ''}`}>
                    {reg.status}
                  </span>
                </div>

                {reg.screenshot && (
                  <img
                    src={reg.screenshot}
                    alt="Payment proof"
                    className="reg-screenshot"
                    onClick={() => window.open(reg.screenshot, '_blank')}
                  />
                )}

                <div className="reg-actions">
                  <button className="btn btn-primary" onClick={() => updateRegistrationStatus(reg.id, 'approved')}>Approve</button>
                  <button className="btn btn-delete" onClick={() => updateRegistrationStatus(reg.id, 'rejected')}>Reject</button>
                  <button className="btn btn-ghost" onClick={() => deleteRegistration(reg.id)}>Delete</button>
                </div>

                <div className="room-send-box">
                  <input
                    type="text"
                    placeholder="Room ID"
                    value={roomDetails[reg.id]?.roomId || ''}
                    onChange={(e) => handleRoomDetailChange(reg.id, 'roomId', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Password"
                    value={roomDetails[reg.id]?.roomPass || ''}
                    onChange={(e) => handleRoomDetailChange(reg.id, 'roomPass', e.target.value)}
                  />
                  <button className="btn btn-primary" onClick={() => sendRoomDetails(reg)}>Send via WhatsApp</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        )}
      </div>
    );
  }

  return (
    <>
      <header>
        <nav>
          <div className="logo"><span className="dot"></span>BATTLE<span className="logo-hub">HUB</span></div>
          <ul className={`nav-links ${menuOpen ? 'open' : ''}`}>
            <li><a href="#tournaments" onClick={() => setMenuOpen(false)}>Tournaments</a></li>
            <li><a href="#how" onClick={() => setMenuOpen(false)}>How It Works</a></li>
            <li><a href="#winners" onClick={() => setMenuOpen(false)}>Winners</a></li>
            <li><a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a></li>
          </ul>
          <div className="nav-cta">
            <a href="#" className="btn btn-ghost">Contact</a>
            <a href="#tournaments" className="btn btn-primary">Join Tournament</a>
            <button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
              <span></span><span></span><span></span>
            </button>
          </div>
        </nav>
      </header>

      <section className="hero">
        <div className="zone-ring"></div>
        <div className="hero-content">
          <div className="eyebrow">Pakistan PUBG Mobile Arena</div>
          <h1>ENTER THE ZONE.<br />WIN THE PRIZE.</h1>
          <p className="sub">BattleHub is where Pakistan PUBG Mobile players compete for real. No more scattered WhatsApp groups - join a tournament, get verified, and get paid.</p>
          <div className="hero-actions">
            <a href="#tournaments" className="btn btn-primary">Browse Tournaments</a>
            <a href="#how" className="btn btn-ghost">See How It Works</a>
          </div>
          <div className="hero-stats">
            <div><div className="num">12,400+</div><div className="label">Players Registered</div></div>
            <div><div className="num">310</div><div className="label">Tournaments Hosted</div></div>
            <div><div className="num">Rs18.2L</div><div className="label">Prize Money Paid</div></div>
          </div>
        </div>
      </section>

      <section id="tournaments">
        <div className="sec-head">
          <div className="eyebrow">Live Right Now</div>
          <h2>Active Tournaments</h2>
          <p>Pick your mode, check the slots, and register in under two minutes.</p>
        </div>
        <div className="grid-3">
          {loadingTournaments && <p className="featured-sub">Tournaments load ho rahe hain...</p>}
          {tournaments.map(t => (
            <div className="t-card" key={t.id}>
              <div
                className="t-thumb"
                style={t.image ? { backgroundImage: `url(${t.image})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
              >
                <span className={`status-tag ${t.status === 'Open' ? 'status-open' : 'status-closed'}`}>{t.status}</span>
                <span className="mode-tag">{t.mode}</span>
              </div>
              <div className="t-body">
                <h4>{t.name}</h4>
                <div className="t-row"><span>Entry Fee</span><b>Rs{t.entryFee}</b></div>
                <div className="t-row"><span>Prize Pool</span><b>Rs{t.prizePool}</b></div>
                <div className="t-row"><span>Per Kill Reward</span><b>Rs{t.perKillReward || 0}</b></div>
                <div className="t-row"><span>Date & Time</span><b>{t.date} - {t.time}</b></div>
                {t.status === 'Open' ? (
                  <button className="btn btn-primary" onClick={() => openModal(t)}>Join Now</button>
                ) : (
                  <button className="btn btn-ghost" disabled>Slots Full</button>
                )}
              </div>
            </div>
          ))}
          {!loadingTournaments && tournaments.length === 0 && <p className="featured-sub">Filhal koi tournament available nahi hai.</p>}
        </div>
      </section>

      <section id="how">
        <div className="sec-head">
          <div className="eyebrow">Four Steps</div>
          <h2>How BattleHub Works</h2>
        </div>
        <div className="steps">
          <div className="step"><div className="num">01</div><h4>Pick a Tournament</h4><p>Browse open tournaments by mode, entry fee, and prize pool.</p></div>
          <div className="step"><div className="num">02</div><h4>Register and Pay</h4><p>Fill your PUBG details and upload your payment screenshot.</p></div>
          <div className="step"><div className="num">03</div><h4>Get Room Details</h4><p>Once approved, receive your Room ID and password before match time.</p></div>
          <div className="step"><div className="num">04</div><h4>Play and Get Paid</h4><p>Compete, win, and receive your prize - no chasing admins on WhatsApp.</p></div>
        </div>
      </section>

      <section className="why">
        <div className="sec-head">
          <div className="eyebrow">Why Players Trust Us</div>
          <h2>Why Choose BattleHub</h2>
        </div>
        <div className="why-grid">
          <div className="why-item"><div className="ico"></div><h4>Verified Payments</h4><p>Every registration is manually checked before you get added to the tournament.</p></div>
          <div className="why-item"><div className="ico"></div><h4>Fair Play</h4><p>Room details are published to everyone at the same time - no shortcuts.</p></div>
          <div className="why-item"><div className="ico"></div><h4>Prizes That Get Paid</h4><p>Winners are published publicly and prize status is tracked until it is sent.</p></div>
        </div>
      </section>

      <section id="winners">
        <div className="sec-head">
          <div className="eyebrow">Hall of Fame</div>
          <h2>Recent Winners</h2>
        </div>
        <div className="winners-grid">
          <div className="w-card"><div className="w-badge"><div className="in">1st</div></div><h4>ShadowSniper_PK</h4><div className="tname">Friday Showdown</div><div className="prize">Rs15,000</div></div>
          <div className="w-card"><div className="w-badge"><div className="in">1st</div></div><h4>Team Falcon</h4><div className="tname">Squad Series</div><div className="prize">Rs50,000</div></div>
          <div className="w-card"><div className="w-badge"><div className="in">1st</div></div><h4>ZeeGamerX</h4><div className="tname">Solo Clash</div><div className="prize">Rs8,000</div></div>
          <div className="w-card"><div className="w-badge"><div className="in">1st</div></div><h4>Duo Reapers</h4><div className="tname">Miramar Rush</div><div className="prize">Rs20,000</div></div>
        </div>
      </section>

      <section id="faq">
        <div className="sec-head">
          <div className="eyebrow">Questions</div>
          <h2>Frequently Asked</h2>
        </div>
        <div className="faq">
          <details className="faq-item" open>
            <summary>How do I join a tournament?</summary>
            <p>Choose an open tournament, click Join, fill in your PUBG Name, UID and WhatsApp number, then upload your payment screenshot. You will get confirmation once admin approves it.</p>
          </details>
          <details className="faq-item">
            <summary>When do I get the Room ID and Password?</summary>
            <p>Room details are published shortly before match time, only to approved players.</p>
          </details>
          <details className="faq-item">
            <summary>How do I receive my prize if I win?</summary>
            <p>Winners are announced on the Winners page. Prize is sent to your provided payment details and marked as paid once sent.</p>
          </details>
          <details className="faq-item">
            <summary>What payment methods are accepted?</summary>
            <p>Send payment to our SADApay account. Details are shown when you register.</p>
          </details>
        </div>
      </section>

      <section className="cta">
        <div className="eyebrow">Ready?</div>
        <h2>Your Next Win Starts Here</h2>
        <p>Join thousands of players competing on Pakistan own tournament platform.</p>
        <a href="#tournaments" className="btn btn-primary">Browse Tournaments</a>
      </section>

      <footer>
        <div className="foot-grid">
          <div>
            <div className="logo foot-logo"><span className="dot"></span>BATTLE<span className="logo-hub">HUB</span></div>
            <p className="foot-desc">Pakistan professional PUBG Mobile tournament platform. Built for players who play to win.</p>
          </div>
          <div>
            <h5>Platform</h5>
            <ul><li><a href="#tournaments">Tournaments</a></li><li><a href="#winners">Winners</a></li><li><a href="#how">How It Works</a></li></ul>
          </div>
          <div>
            <h5>Support</h5>
            <ul><li><a href="#">WhatsApp Support</a></li><li><a href="#">Email Support</a></li><li><a href="#">Contact Form</a></li></ul>
          </div>
          <div>
            <h5>Legal</h5>
            <ul><li><a href="#">Privacy Policy</a></li><li><a href="#">Terms and Conditions</a></li><li><a href="#" onClick={(e) => { e.preventDefault(); openAdmin(); }}>Admin</a></li></ul>
          </div>
        </div>
        <div className="foot-bottom">
          <span>2026 BattleHub. All rights reserved.</span>
          <span>Made for Pakistan PUBG Mobile community.</span>
        </div>
      </footer>

      {modalTournament && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>x</button>

            {!submitted ? (
              <>
                <div className="eyebrow">Tournament Registration</div>
                <h3 className="modal-title">{modalTournament.name}</h3>

                <form onSubmit={handleRegSubmit} className="reg-form">
                  <label>PUBG Name
                    <input type="text" name="pubgName" value={regForm.pubgName} onChange={handleRegChange} required />
                  </label>

                  <label>PUBG UID
                    <input type="text" name="pubgUid" value={regForm.pubgUid} onChange={handleRegChange} required />
                  </label>

                  <label>WhatsApp Number
                    <input type="tel" name="whatsapp" value={regForm.whatsapp} onChange={handleRegChange} placeholder="03xxxxxxxxx" required />
                  </label>

                  <label>Tournament Name
                    <input type="text" value={modalTournament.name} disabled />
                  </label>

                  <label>Entry Fee
                    <input type="text" value={`Rs${modalTournament.entryFee}`} disabled />
                  </label>

                  <div className="pay-info-box">
                    Send payment to SADApay account: 03485731997
                  </div>

                  <label>Upload Payment Screenshot
                    <input type="file" accept="image/*" onChange={handleFile} required />
                  </label>

                  <p className="pay-warning">Payment ka screenshot lazmi bhejen</p>

                  {regForm.screenshot && (
                    <img src={regForm.screenshot} alt="Payment proof preview" className="screenshot-preview" />
                  )}

                  <button type="submit" className="btn btn-primary submit-btn">Submit Registration</button>
                </form>
              </>
            ) : (
              <div className="success-box">
                <div className="success-icon">Done</div>
                <h3 className="modal-title">Registration Submitted!</h3>
                <p className="featured-sub">Your entry for <b>{modalTournament.name}</b> has been received. Room ID and password will be sent to your WhatsApp once approved.</p>
                <button className="btn btn-primary" onClick={closeModal}>Done</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default App;