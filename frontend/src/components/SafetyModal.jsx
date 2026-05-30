import FingerprintPanel from './FingerprintPanel.jsx';

export default function SafetyModal({ contact, verifyContact, onClose }) {
  if (!contact) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content !max-w-sm" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Safety check</h2>
            <p className="mt-1 text-xs text-slate-400">Compare this fingerprint with your contact.</p>
          </div>
          <button type="button" onClick={onClose} className="icon-button shrink-0" aria-label="Close safety check">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <FingerprintPanel contact={contact} verifyContact={verifyContact} />
      </div>
    </div>
  );
}
