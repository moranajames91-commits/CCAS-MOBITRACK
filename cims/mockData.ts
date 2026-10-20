/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Cashier, Transaction } from '../types';

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_CASHIERS: Cashier[] = [];

// Seed some transaction history spanning the past 3 days for beautiful charts inside the Admin Panel
export const generateMockTransactions = (): Transaction[] => {
  return [];
};
