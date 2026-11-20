import React from 'react';
import { pieceColor, type PieceChar } from '../shared/chessEngine.ts';

interface ChessPieceSvgProps {
  piece: PieceChar;
  className?: string;
}

export const ChessPieceSvg: React.FC<ChessPieceSvgProps> = ({
  piece,
  className = 'h-full w-full',
}) => {
  const isWhite = pieceColor(piece) === 'w';
  const kind = piece.toUpperCase();

  // Neo-Staunton palette matching crisp ivory white & sculpted slate-charcoal black
  const fill = isWhite ? '#faf9f5' : '#53514e';
  const shadowFill = isWhite ? '#d7d4cc' : '#3d3b38';
  const stroke = isWhite ? '#2c2b29' : '#1b1a18';
  const innerStroke = isWhite ? '#2c2b29' : '#b5b1aa';

  return (
    <svg
      viewBox="0 0 45 45"
      aria-hidden="true"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {kind === 'P' && (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Main Pawn Silhouette */}
          <path
            d="M 22.5,9.5 C 19.7,9.5 17.5,11.7 17.5,14.5 C 17.5,16.1 18.2,17.5 19.4,18.4 C 16.5,19.9 14.8,22.8 14.8,26.2 C 14.8,28.5 15.8,30.6 17.4,32 C 13.7,32.9 11.3,35.2 11,38.5 L 34,38.5 C 33.7,35.2 31.3,32.9 27.6,32 C 29.2,30.6 30.2,28.5 30.2,26.2 C 30.2,22.8 28.5,19.9 25.6,18.4 C 26.8,17.5 27.5,16.1 27.5,14.5 C 27.5,11.7 25.3,9.5 22.5,9.5 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.6"
          />
          {/* Subtle right-side shading */}
          <path
            d="M 23.2,10.5 C 25.5,11 26.8,13 26.5,15.3 C 26.2,16.8 25.2,17.7 24.4,18.3 C 27.2,19.8 29,22.6 29,26.1 C 29,28.5 28,30.5 26.5,31.8 C 29.9,32.8 32,34.9 32.5,37.7 L 28.2,37.7 C 27.6,34.4 25.9,32.3 24.2,31.3 C 25.8,29.6 26.4,27.2 26,24.6 C 25.6,21.8 24.3,19.6 22.6,18.5 C 24.2,17.2 25.1,15.2 24.7,13 C 24.5,11.8 23.9,11 23.2,10.5 Z"
            fill={shadowFill}
            opacity="0.7"
          />
          {/* Re-stroke clean outline over shading */}
          <path
            d="M 22.5,9.5 C 19.7,9.5 17.5,11.7 17.5,14.5 C 17.5,16.1 18.2,17.5 19.4,18.4 C 16.5,19.9 14.8,22.8 14.8,26.2 C 14.8,28.5 15.8,30.6 17.4,32 C 13.7,32.9 11.3,35.2 11,38.5 L 34,38.5 C 33.7,35.2 31.3,32.9 27.6,32 C 29.2,30.6 30.2,28.5 30.2,26.2 C 30.2,22.8 28.5,19.9 25.6,18.4 C 26.8,17.5 27.5,16.1 27.5,14.5 C 27.5,11.7 25.3,9.5 22.5,9.5 Z"
            stroke={stroke}
            strokeWidth="1.6"
          />
          <path
            d="M 18.5,18.6 Q 22.5,19.6 26.5,18.6 M 17.4,32 Q 22.5,33.2 27.6,32"
            stroke={innerStroke}
            strokeWidth="1.25"
          />
        </g>
      )}

      {kind === 'R' && (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path
            d="M 11.5,9 L 15.5,9 L 15.5,12 L 19.5,12 L 19.5,9 L 25.5,9 L 25.5,12 L 29.5,12 L 29.5,9 L 33.5,9 L 33.5,14.5 L 30.5,17.5 L 30.5,30 L 33,32.5 L 33,35 L 34.5,35 L 34.5,38.5 L 10.5,38.5 L 10.5,35 L 12,35 L 12,32.5 L 14.5,30 L 14.5,17.5 L 11.5,14.5 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.6"
          />
          {/* Right-side architectural shading */}
          <path
            d="M 26.5,17.5 L 29.7,17.5 L 29.7,30 L 32.1,32.5 L 32.1,35 L 33.6,35 L 33.6,37.7 L 27.5,37.7 L 27.5,35 L 26.5,32.5 Z"
            fill={shadowFill}
            opacity="0.72"
          />
          <path
            d="M 11.5,9 L 15.5,9 L 15.5,12 L 19.5,12 L 19.5,9 L 25.5,9 L 25.5,12 L 29.5,12 L 29.5,9 L 33.5,9 L 33.5,14.5 L 30.5,17.5 L 30.5,30 L 33,32.5 L 33,35 L 34.5,35 L 34.5,38.5 L 10.5,38.5 L 10.5,35 L 12,35 L 12,32.5 L 14.5,30 L 14.5,17.5 L 11.5,14.5 Z"
            stroke={stroke}
            strokeWidth="1.6"
          />
          <path
            d="M 14.5,17.5 L 30.5,17.5 M 14.5,30 L 30.5,30 M 12,32.5 L 33,32.5 M 12,35 L 33,35"
            stroke={innerStroke}
            strokeWidth="1.25"
          />
        </g>
      )}

      {kind === 'N' && (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Sculpted Neo-Staunton Stallion */}
          <path
            d="M 22,10 C 31.8,11.2 37,18.2 35.8,35 L 37,35 L 37,38.5 L 10.5,38.5 L 10.5,35 L 13,35 C 13.6,29.2 19.2,27.2 21.8,22.8 C 19.6,23.2 17.5,25.2 14.5,26.8 C 12.2,27.9 9.5,27.6 8.5,25.6 C 7.7,24 9.5,21.2 11.6,18.6 C 12.8,17.1 14,15.3 14.8,13.6 C 14.2,12 14.2,9.8 15.2,8.4 C 16.5,8.2 18.2,10.2 18.8,11.2 C 19.7,10.4 20.8,8.5 22.3,8 C 23,8.5 22.5,9.5 22,10 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.6"
          />
          {/* Mane & right-side neck shading */}
          <path
            d="M 22.8,11.2 C 30.6,12.6 35.3,19.2 34.4,34.6 L 29.2,34.6 C 30.2,23.5 27.6,15.2 22.8,11.2 Z"
            fill={shadowFill}
            opacity="0.72"
          />
          {/* Re-stroke crisp silhouette */}
          <path
            d="M 22,10 C 31.8,11.2 37,18.2 35.8,35 L 37,35 L 37,38.5 L 10.5,38.5 L 10.5,35 L 13,35 C 13.6,29.2 19.2,27.2 21.8,22.8 C 19.6,23.2 17.5,25.2 14.5,26.8 C 12.2,27.9 9.5,27.6 8.5,25.6 C 7.7,24 9.5,21.2 11.6,18.6 C 12.8,17.1 14,15.3 14.8,13.6 C 14.2,12 14.2,9.8 15.2,8.4 C 16.5,8.2 18.2,10.2 18.8,11.2 C 19.7,10.4 20.8,8.5 22.3,8 C 23,8.5 22.5,9.5 22,10 Z"
            stroke={stroke}
            strokeWidth="1.6"
          />
          {/* Eye, nostril & mane curve */}
          <circle cx="16.2" cy="15.8" r="1.25" fill={innerStroke} />
          <path
            d="M 10.7,24.4 C 10.9,23.8 11.4,23.4 11.9,23.3 M 13,35 L 35.8,35 M 24.8,13.5 C 29.5,16.5 32.2,23 32,32.5"
            stroke={innerStroke}
            strokeWidth="1.25"
          />
        </g>
      )}

      {kind === 'B' && (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Top Finial */}
          <circle
            cx="22.5"
            cy="7.8"
            r="2.4"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
          />
          {/* Miter & Pedestal */}
          <path
            d="M 22.5,10.4 C 17,13.2 14.5,18.8 15,24.2 C 15.3,27.3 16.6,29.5 18,31.2 L 15,32.8 L 15,35 L 11,35 L 11,38.5 L 34,38.5 L 34,35 L 30,35 L 30,32.8 L 27,31.2 C 28.4,29.5 29.7,27.3 30,24.2 C 30.5,18.8 28,13.2 22.5,10.4 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.6"
          />
          {/* Right-side miter shading */}
          <path
            d="M 22.8,11.6 C 27,14.5 28.8,19.4 28.5,24.2 C 28.3,27 27.2,29.2 25.8,30.9 L 28.6,32.8 L 28.6,35 L 32.8,35 L 32.8,37.7 L 26.2,37.7 L 26.2,35 L 24.4,31.2 C 25.4,27.8 26,23.2 25.2,18.2 C 24.7,15.3 23.8,13.1 22.8,11.6 Z"
            fill={shadowFill}
            opacity="0.72"
          />
          <path
            d="M 22.5,10.4 C 17,13.2 14.5,18.8 15,24.2 C 15.3,27.3 16.6,29.5 18,31.2 L 15,32.8 L 15,35 L 11,35 L 11,38.5 L 34,38.5 L 34,35 L 30,35 L 30,32.8 L 27,31.2 C 28.4,29.5 29.7,27.3 30,24.2 C 30.5,18.8 28,13.2 22.5,10.4 Z"
            stroke={stroke}
            strokeWidth="1.6"
          />
          {/* Diagonal miter cleft + collar bands */}
          <path
            d="M 19,21.5 L 25.2,15.2 M 18,31.2 Q 22.5,32.4 27,31.2 M 15,35 L 30,35"
            stroke={innerStroke}
            strokeWidth="1.35"
          />
        </g>
      )}

      {kind === 'Q' && (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Five Royal Crown Pearls */}
          {[
            [7.5, 13],
            [14.2, 9.6],
            [22.5, 8.2],
            [30.8, 9.6],
            [37.5, 13],
          ].map(([cx, cy], idx) => (
            <circle
              key={idx}
              cx={cx}
              cy={cy}
              r="2.1"
              fill={fill}
              stroke={stroke}
              strokeWidth="1.45"
            />
          ))}
          {/* Coronet & Base */}
          <path
            d="M 8.5,15.2 L 14,25.5 L 15,12 L 19.5,24.8 L 22.5,10.5 L 25.5,24.8 L 30,12 L 31,25.5 L 36.5,15.2 L 31.8,31 L 31.8,35 L 34,35 L 34,38.5 L 11,38.5 L 11,35 L 13.2,35 L 13.2,31 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.6"
          />
          {/* Subtle right-side shading */}
          <path
            d="M 35.1,16.6 L 30.6,31 L 30.6,35 L 32.8,35 L 32.8,37.7 L 26.8,37.7 L 26.8,31.2 L 30.5,14.8 L 30.2,26.2 Z"
            fill={shadowFill}
            opacity="0.7"
          />
          <path
            d="M 8.5,15.2 L 14,25.5 L 15,12 L 19.5,24.8 L 22.5,10.5 L 25.5,24.8 L 30,12 L 31,25.5 L 36.5,15.2 L 31.8,31 L 31.8,35 L 34,35 L 34,38.5 L 11,38.5 L 11,35 L 13.2,35 L 13.2,31 Z"
            stroke={stroke}
            strokeWidth="1.6"
          />
          <path
            d="M 13.2,31 Q 22.5,29.5 31.8,31 M 13.2,35 L 31.8,35"
            stroke={innerStroke}
            strokeWidth="1.3"
          />
        </g>
      )}

      {kind === 'K' && (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Royal Cross */}
          <path
            d="M 22.5,11.8 L 22.5,6 M 19.5,8.5 L 25.5,8.5"
            stroke={stroke}
            strokeWidth="2.1"
          />
          {!isWhite && (
            <path
              d="M 22.5,11.6 L 22.5,6.4 M 19.9,8.5 L 25.1,8.5"
              stroke={innerStroke}
              strokeWidth="0.9"
            />
          )}
          {/* Crown Dome Crest */}
          <path
            d="M 22.5,25 C 22.5,25 26.8,17.8 25.2,14.5 C 25.2,14.5 24,12.2 22.5,12.2 C 21,12.2 19.8,14.5 19.8,14.5 C 18.2,17.8 22.5,25 22.5,25 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.6"
          />
          {/* Left & Right Crown Lobes + Pedestal */}
          <path
            d="M 13.5,31.2 C 8.5,27 7,20 11,16.2 C 14.5,13 20,16.5 22.5,22.2 C 25,16.5 30.5,13 34,16.2 C 38,20 36.5,27 31.5,31.2 L 31.5,35 L 34,35 L 34,38.5 L 11,38.5 L 11,35 L 13.5,35 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.6"
          />
          {/* Right-side crown shading */}
          <path
            d="M 32.8,17 C 36.2,20.3 34.8,26.6 30.3,30.6 L 30.3,35 L 32.8,35 L 32.8,37.7 L 26.8,37.7 L 26.8,31.2 C 30.2,27.4 31.4,21.2 29.2,16.4 C 30.6,16.1 31.8,16.2 32.8,17 Z"
            fill={shadowFill}
            opacity="0.72"
          />
          <path
            d="M 13.5,31.2 C 8.5,27 7,20 11,16.2 C 14.5,13 20,16.5 22.5,22.2 C 25,16.5 30.5,13 34,16.2 C 38,20 36.5,27 31.5,31.2 L 31.5,35 L 34,35 L 34,38.5 L 11,38.5 L 11,35 L 13.5,35 Z"
            stroke={stroke}
            strokeWidth="1.6"
          />
          {/* Inner Crown Rib & Base Lines */}
          <path
            d="M 22.5,22.2 L 22.5,30.4 M 13.5,31.2 Q 22.5,29.2 31.5,31.2 M 13.5,35 L 31.5,35"
            stroke={innerStroke}
            strokeWidth="1.3"
          />
        </g>
      )}
    </svg>
  );
};
