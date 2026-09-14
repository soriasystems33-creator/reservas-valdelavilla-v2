import { Montserrat } from 'next/font/google';
import './globals.css';

const montserratFont = Montserrat({
  subsets: ['latin'],
  weight: ['200','300','400','500','600','700'],
  variable: '--font-montserrat',
});

export const metadata = {
  title: 'Restaurante Valdelavilla — Reservas Online',
  description: 'Reserva tu mesa de manera rápida y fácil. Elige fecha, hora, zona y comensales.',
  keywords: 'reservas, restaurante, mesa, online',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={`${montserratFont.variable} font-sans bg-green-50 text-[#1e293b] antialiased`}>
        {children}
      </body>
    </html>
  );
}

