import { useEffect, useRef } from 'react';

const EMOJI_CATEGORIES = [
  { name: 'Smileys', emojis: ['😀', '😄', '😂', '😊', '😍', '🥳', '😎', '🤔', '😅', '😭', '😡', '🤯', '😴', '🤝', '🙏', '✨', '🔥', '🎉'] },
  { name: 'Gestures', emojis: ['👋', '👍', '👎', '👌', '✌️', '🤞', '👏', '🙌', '💪', '🤙', '👉', '👀'] },
  { name: 'Hearts', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💕', '💔', '💯', '⭐'] }
];

export default function EmojiPicker({ onSelect, onClose }) {
  const pickerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div ref={pickerRef} className="emoji-picker" role="dialog" aria-label="Emoji picker">
      <div className="border-b border-white/5 p-3 text-sm font-semibold text-white">Emojis</div>
      <div className="flex-1 overflow-y-auto p-2">
        {EMOJI_CATEGORIES.map((category) => (
          <div key={category.name} className="mb-4">
            <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{category.name}</h3>
            <div className="grid grid-cols-6 gap-1">
              {category.emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onSelect(emoji)}
                  className="grid h-10 w-10 place-items-center rounded-xl text-xl transition-colors hover:bg-white/10 focus-visible:bg-white/10"
                  aria-label={`Add ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
