import { Nunito } from 'next/font/google';
import './globals.css';

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['300','400','500','600','700','800'],
  variable: '--font-nunito',
});

export const metadata = {
  title: 'GastroManager — Reservas Online',
  description: 'Reserva tu mesa de manera rápida y fácil. Elige fecha, hora, zona y comensales.',
  keywords: 'reservas, restaurante, mesa, online',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={`${nunito.variable} font-sans bg-[#f8fafc] text-[#1e293b] antialiased`}>
        {children}
      </body>
    </html>
  );
}
