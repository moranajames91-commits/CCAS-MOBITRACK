/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string;
  barcode: string;
  brand?: string;
  name: string;
  ram?: string;
  storageGb?: string;
  price: number;
  costPrice?: number | null;
  stock: number;
  category: string;
  description?: string;
  image?: string;
  warrantyDays?: number;
}

export interface Cashier {
  username: string; // Used as unique identifier / login
  fullName: string;
  passwordHash: string; // Represented simply for local DB demo
  status: 'active' | 'inactive';
  lastActive?: string;
  branch?: string;
}

export interface TransactionItem {
  productId: string;
  name: string;
  price: number;
  costPrice?: number;
  quantity: number;
  subtotal: number;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  warrantyDays?: number;
}

export interface Transaction {
  id: string; // e.g. TR-20260529-001
  cashierUsername: string;
  cashierName: string;
  items: TransactionItem[];
  discount: number; // percentage or fixed amount
  subtotal: number;
  vatableSales?: number;
  vatAmount?: number;
  additionalCharge?: number;
  total: number;
  paymentReceived: number;
  changeAmount: number;
  timestamp: string; // ISO string
  branch?: string;
  customerLocation?: string;
  latitude?: number;
  longitude?: number;
}

export interface OperatingExpense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  createdAt?: string;
}

export interface RepairTicketItem {
  productId: string;
  name: string;
  quantity: number;
  issue?: string;
  status?: string;
}

export interface RepairTicket {
  id: string;
  customerName: string;
  contact: string;
  device: string;
  reportedIssue: string;
  status: 'open' | 'in_progress' | 'completed' | 'closed';
  assignedTo: string;
  createdAt: string;
  updatedAt?: string;
  warrantyDays?: number;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  location?: string;
  customerLocation?: string;
  customerPostalCode?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  items: RepairTicketItem[];
}

export type UserRole = 'admin' | 'cashier' | null;

export interface AuthState {
  role: UserRole;
  username: string;
  fullName: string;
}
