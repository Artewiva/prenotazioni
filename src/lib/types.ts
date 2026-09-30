export type Status =
  | "in_attesa"
  | "confermata"
  | "in_corso"
  | "completata"
  | "cancellata";

export type Source = "telefono" | "web" | "walk_in";

export type Role = "admin" | "manager";

export interface Reservation {
  id: number;
  customerName: string;
  phone: string;
  email: string | null;
  party: number;
  tableId: number;
  tableNumber: number;
  tableZone: string;
  tableSeats: number;
  date: string;
  time: string;
  status: Status;
  source: Source;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Table {
  id: number;
  number: number;
  zone: string;
  seats: number;
  active: boolean;
  notes: string | null;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

export interface Settings {
  restaurantName: string;
  phone: string;
  whatsappNumber: string;
  openingHour: string;
  closingHour: string;
  slotMinutes: number;
  waTemplate: string;
}
