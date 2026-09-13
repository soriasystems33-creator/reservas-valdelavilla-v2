import { Montserrat } from 'next/font/google';
import './globals.css';

const Montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['200','300','400','500','600','700'],
  variable: '--font-Montserrat',
});

export const metadata = {
  title: 'GastroManager — Reservas Online',
  description: 'Reserva tu mesa de manera rápida y fácil. Elige fecha, hora, zona y comensales.',
  keywords: 'reservas, restaurante, mesa, online',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={`${Montserrat.variable} font-sans bg-[#f8fafc] text-[#1e293b] antialiased`}>
        {children}
      </body>
    </html>
  );
}

