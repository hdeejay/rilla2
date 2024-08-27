import React from 'react';

interface FloatingNoteBoxProps {
  content: string;
  position: { x: number; y: number };
}

const FloatingNoteBox: React.FC<FloatingNoteBoxProps> = ({ content, position }) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translateY(-100%)',
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: '4px',
        padding: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        zIndex: 1000,
      }}
    >
      <p>{content}</p>
    </div>
  );
};

export default FloatingNoteBox;