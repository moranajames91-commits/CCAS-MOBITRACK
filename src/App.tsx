/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Product, Cashier, Transaction, OperatingExpense, RepairTicket, AuthState } from './types';
import { INITIAL_PRODUCTS, INITIAL_CASHIERS, generateMockTransactions } from '../cims/mockData';
import LoginScreen from './components/LoginScreen';
import CashierPOS from './components/CashierPOS';
import AdminDashboard from './components/AdminDashboard';

const getSSTTimestamp = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  const values: Record<string, string> = {};
  formatter.formatToParts(date).forEach(part => {
    if (part.type !== 'literal') values[part.type] = part.value;
  });
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}+08:00`;
};

const readOperatingExpenseResponse = async (response: Response, operation: string) => {
  const responseText = await response.text();
  let payload: unknown;
  try {
    payload = responseText.trim() ? JSON.parse(responseText) : null;
  } catch {
    const detail = responseText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 250);
    throw new Error(
      detail
        ? `The expense API returned HTTP ${response.status} instead of JSON: ${detail}. Update cims\\api.php on the XAMPP server and restart Apache.`
        : `The expense API returned an empty response (HTTP ${response.status}). Update cims\\api.php on the XAMPP server and restart Apache.`
    );
  }

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new Error(`The expense API returned an empty or invalid response (HTTP ${response.status}). Update cims\\api.php on the XAMPP server and restart Apache.`);
  }

  const result = payload as Record<string, unknown>;
  if (!response.ok || result.status !== 'success') {
    if (result.message === 'Invalid endpoint action') {
      throw new Error(`The XAMPP API does not support ${operation}. Copy the current cims\\api.php to C:\\xampp\\htdocs\\cims\\api.php and restart Apache.`);
    }
    throw new Error(
      typeof result.message === 'string'
        ? result.message
        : `Could not ${operation} (HTTP ${response.status}).`
    );
  }
}

const getDefaultApiUrl = () => {
  const hostname = window.location.hostname || 'localhost';
  return `http://${hostname}/cims/api.php`;
};

const getInitialApiUrl = () => {
  const hostname = window.location.hostname || 'localhost';
  const cachedUrl = localStorage.getItem('cims_api_url');

  if (cachedUrl) {
    try {
      const cachedHostname = new URL(cachedUrl).hostname;
      const isLocalBrowser = hostname === 'localhost' || hostname === '127.0.0.1';
      const isLocalApi = cachedHostname === 'localhost' || cachedHostname === '127.0.0.1';
      if (isLocalBrowser || !isLocalApi) return cachedUrl;
    } catch {
      // Fall back to the host-derived URL when a cached value is malformed.
    }
  }

  return getDefaultApiUrl();
};

export default function App() {
  
  // 1. Initialize Products State from localStorage with seed fallback
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('cims_products');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to parse cached products:', e);
      }
    }
    // Set seed fallback and save it
    localStorage.setItem('cims_products', JSON.stringify(INITIAL_PRODUCTS));
    return INITIAL_PRODUCTS;
  });

  // 2. Initialize Cashiers Registry from localStorage with seed fallback
  const [cashiers, setCashiers] = useState<Cashier[]>(() => {
    const saved = localStorage.getItem('cims_cashiers');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to parse cached cashiers:', e);
      }
    }
    localStorage.setItem('cims_cashiers', JSON.stringify(INITIAL_CASHIERS));
    return INITIAL_CASHIERS;
  });

  // 2.5 Dynamic Cache layer for Administrators
  const [admins, setAdmins] = useState<{ username: string; fullName: string; passwordHash: string }[]>(() => {
    const saved = localStorage.getItem('cims_admins');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to parse cached admins:', e);
      }
    }
    const defaults = [{ username: 'admin', fullName: 'System Administrator', passwordHash: 'admin123' }];
    localStorage.setItem('cims_admins', JSON.stringify(defaults));
    return defaults;
  });

  // 3. Initialize Transaction Events from localStorage with seed fallback
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('cims_transactions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to parse cached transactions:', e);
      }
    }
    const seeds = generateMockTransactions();
    localStorage.setItem('cims_transactions', JSON.stringify(seeds));
    return seeds;
  });

  // 3.5 Initialize Repair Ticket state from localStorage
  const [repairTickets, setRepairTickets] = useState<RepairTicket[]>(() => {
    const saved = localStorage.getItem('cims_repair_tickets');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to parse cached repair tickets:', e);
      }
    }
    return [];
  });

  const [operatingExpenses, setOperatingExpenses] = useState<OperatingExpense[]>(() => {
    const saved = localStorage.getItem('cims_operating_expenses');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to parse cached operating expenses:', e);
      }
    }
    return [];
  });

  // 4. Session authentication state
  const [currentAuth, setCurrentAuth] = useState<AuthState | null>(() => {
    const cachedSession = localStorage.getItem('cims_session');
    if (cachedSession) {
      try {
        return JSON.parse(cachedSession);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  // 5. XAMPP API Integration Configurations
  const [useApi, setUseApi] = useState<boolean>(() => {
    const cached = localStorage.getItem('cims_use_api');
    return cached === null ? true : (cached === 'true');
  });
  
  const [apiUrl, setApiUrl] = useState<string>(() => {
    // Use the host serving Vite so another device reaches the shared XAMPP server.
    return getInitialApiUrl();
  });

  const [loadingApi, setLoadingApi] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Central function to pull live data from the connected XAMPP MySQL database
  const fetchFromApi = React.useCallback(async () => {
    if (!useApi || !apiUrl) return;
    setLoadingApi(true);
    setApiError(null);
    try {
      // Helper function to safely fetch and parse JSON or raise human-friendly errors
      const safeFetchJson = async (url: string) => {
        const res = await fetch(url);
        const text = await res.text();
        const trimmed = text.trim();

        // Detect HTML-formatted error pages or PHP warnings/notices mixed into the response
        if (trimmed.includes('<br />') || trimmed.includes('<b>Warning</b>') || trimmed.includes('<b>Fatal error</b>') || trimmed.includes('<b>Notice</b>') || trimmed.startsWith('<')) {
          // Parse out raw text without HTML tag blocks to let user know the specific PHP error or connect failure
          const cleanText = trimmed.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          throw new Error(`PHP/Database Environment issue: "${cleanText.substring(0, 350)}"`);
        }

        if (!res.ok) {
          throw new Error(`Server returned HTTP status ${res.status}`);
        }

        try {
          return JSON.parse(trimmed);
        } catch (e: any) {
          // If the text contains any HTML-like substring, extract it, otherwise return standard error
          if (trimmed.includes('<') || trimmed.includes('>')) {
            const cleanText = trimmed.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            throw new Error(`PHP Environment Warning/Error: "${cleanText.substring(0, 350)}"`);
          }
          throw new Error(`Unexpected non-JSON response from server: "${trimmed.substring(0, 150)}..." (${e.message})`);
        }
      };

      // Fetch fresh products list
      const pData = await safeFetchJson(`${apiUrl}?action=products`);
      if (pData.status === 'success' && Array.isArray(pData.products)) {
        // Map any numeric fields back to correct formats
        const formattedProducts = pData.products.map((p: any) => ({
          id: p.id,
          barcode: p.barcode,
          brand: p.brand || '',
          name: p.name,
          ram: p.ram || '',
          storageGb: p.storageGb || p.storage_gb || '',
          price: parseFloat(p.price || 0),
          costPrice: p.costPrice != null || p.cost_price != null
            ? parseFloat(String(p.costPrice ?? p.cost_price))
            : undefined,
          stock: parseInt(p.stock || 0),
          category: p.category || 'General',
          description: p.description || '',
          warrantyDays: p.warrantyDays != null || p.warranty_days != null
            ? parseInt(String(p.warrantyDays ?? p.warranty_days), 10)
            : undefined
        }));
        
        // The shared database is authoritative when API sync succeeds.
        // Do not merge stale local products back after another device deletes them.
        setProducts(formattedProducts);
        localStorage.setItem('cims_products', JSON.stringify(formattedProducts));
      } else {
        throw new Error(pData.message || 'Error occurred querying products endpoint.');
      }

      // Fetch fresh cashiers list
      try {
        const cData = await safeFetchJson(`${apiUrl}?action=cashiers`);
        if (cData.status === 'success' && Array.isArray(cData.cashiers)) {
          // Read from cache to retain passwords
          const cachedC = localStorage.getItem('cims_cashiers');
          let parsedC: Cashier[] = [];
          if (cachedC) {
            try { parsedC = JSON.parse(cachedC); } catch(ev) {}
          }
          const formattedCashiers = cData.cashiers.map((apiCashier: any) => {
            const local = parsedC.find(c => c.username.toLowerCase() === apiCashier.username.toLowerCase());
            return {
              username: apiCashier.username,
              fullName: apiCashier.fullName,
              passwordHash: apiCashier.password_hash || (local ? local.passwordHash : '123456'),
              status: apiCashier.status || 'active',
              lastActive: apiCashier.last_active || null
            };
          });

          // The shared database is authoritative. Do not restore deleted cashiers
          // from a stale local cache during the periodic API refresh.
          setCashiers(formattedCashiers);
          localStorage.setItem('cims_cashiers', JSON.stringify(formattedCashiers));
        }
      } catch (cErr: any) {
        console.warn("Could not load cashiers table safely from XAMPP:", cErr);
      }

      // Fetch fresh admins list from XAMPP MySql API
      try {
        const aData = await safeFetchJson(`${apiUrl}?action=admins`);
        if (aData.status === 'success' && Array.isArray(aData.admins)) {
          const formattedAdmins = aData.admins.map((apiAdmin: any) => ({
            username: apiAdmin.username,
            fullName: apiAdmin.fullName,
            passwordHash: apiAdmin.passwordHash || 'admin123'
          }));

          setAdmins(current => {
            const merged = [...formattedAdmins];
            current.forEach(localAdmin => {
              if (!merged.some(a => a.username.toLowerCase() === localAdmin.username.toLowerCase())) {
                merged.push(localAdmin);
              }
            });
            localStorage.setItem('cims_admins', JSON.stringify(merged));
            return merged;
          });
        }
      } catch (aErr: any) {
        console.warn("Could not load admins table safely from XAMPP:", aErr);
      }

      // Fetch fresh transactions list for real-time overview updates
      try {
        const tData = await safeFetchJson(`${apiUrl}?action=transactions`);
        if (tData.status === 'success' && Array.isArray(tData.transactions)) {
          // Ensure fields are formatted correctly
          const formattedTransactions = tData.transactions.map((tx: any) => ({
            id: tx.id,
            cashierUsername: tx.cashierUsername,
            cashierName: tx.cashierName,
            discount: parseFloat(tx.discount || 0),
            subtotal: parseFloat(tx.subtotal || 0),
            total: parseFloat(tx.total || 0),
            paymentReceived: parseFloat(tx.paymentReceived || 0),
            changeAmount: parseFloat(tx.changeAmount || 0),
            timestamp: tx.timestamp,
            branch: tx.branch || tx.storeBranch || 'Unassigned',
            customerLocation: tx.customerLocation || tx.customer_location || undefined,
            latitude: tx.latitude != null ? Number(tx.latitude) : undefined,
            longitude: tx.longitude != null ? Number(tx.longitude) : undefined,
            items: Array.isArray(tx.items) ? tx.items.map((it: any) => ({
              productId: it.productId,
              name: it.name,
              price: parseFloat(it.price || 0),
              costPrice: it.costPrice != null || it.cost_price != null
                ? parseFloat(String(it.costPrice ?? it.cost_price))
                : undefined,
              quantity: parseInt(it.quantity || 1),
              subtotal: parseFloat(it.subtotal || 0),
              warrantyDays: it.warrantyDays != null ? Number(it.warrantyDays) : undefined,
              warrantyStartDate: it.warrantyStartDate || it.warranty_start_date || undefined,
              warrantyEndDate: it.warrantyEndDate || it.warranty_end_date || undefined
            })) : []
          }));

          // The shared database is authoritative whenever the API responds.
          // Keeping seeded/local transactions here makes every device report different data.
          setTransactions(formattedTransactions);
          localStorage.setItem('cims_transactions', JSON.stringify(formattedTransactions));
        }
      } catch (tErr: any) {
        console.warn("Could not load transactions ledger from XAMPP, keeping local data:", tErr);
      }

      try {
        const rData = await safeFetchJson(`${apiUrl}?action=repair_tickets`);
        if (rData.status === 'success' && Array.isArray(rData.repair_tickets)) {
          const formattedRepairTickets = rData.repair_tickets.map((rt: any) => ({
            id: rt.id,
            customerName: rt.customer_name || rt.customerName || '',
            contact: rt.contact || '',
            device: rt.device || '',
            reportedIssue: rt.reported_issue || rt.reportedIssue || '',
            status: rt.status || 'open',
            assignedTo: rt.assigned_to || rt.assignedTo || '',
            createdAt: rt.created_at || rt.createdAt || '',
            updatedAt: rt.updated_at || rt.updatedAt || undefined,
            warrantyStartDate: rt.warranty_start_date || rt.warrantyStartDate || undefined,
            warrantyEndDate: rt.warranty_end_date || rt.warrantyEndDate || undefined,
            warrantyDays: rt.warranty_days != null ? Number(rt.warranty_days) : undefined,
            customerLocation: rt.customer_address || rt.customerLocation || undefined,
            latitude: rt.latitude != null ? Number(rt.latitude) : undefined,
            longitude: rt.longitude != null ? Number(rt.longitude) : undefined,
            notes: rt.notes || '',
            items: Array.isArray(rt.items) ? rt.items.map((item: any) => ({
              productId: item.product_id || item.productId || '',
              name: item.product_name || item.name || '',
              quantity: Number(item.quantity) || 0,
              issue: item.issue || '',
              status: item.status || ''
            })) : []
          }));

          setRepairTickets(formattedRepairTickets);
          localStorage.setItem('cims_repair_tickets', JSON.stringify(formattedRepairTickets));
        }
      } catch (rErr: any) {
        console.warn("Could not load repair tickets from XAMPP:", rErr);
      }

      try {
        const eData = await safeFetchJson(`${apiUrl}?action=operating_expenses`);
        if (eData.status === 'success' && Array.isArray(eData.operatingExpenses)) {
          const formattedExpenses: OperatingExpense[] = eData.operatingExpenses.map((expense: any) => ({
            id: String(expense.id),
            category: String(expense.category || ''),
            description: String(expense.description || ''),
            amount: Number(expense.amount),
            date: String(expense.date || ''),
            createdAt: expense.createdAt || expense.created_at || undefined
          }));
          setOperatingExpenses(formattedExpenses);
          localStorage.setItem('cims_operating_expenses', JSON.stringify(formattedExpenses));
        } else {
          throw new Error(eData.message || 'Invalid operating expenses response.');
        }
      } catch (eErr: any) {
        console.warn('Could not load operating expenses from XAMPP:', eErr);
      }

    } catch (err: any) {
      console.warn("XAMPP API connection warning:", err);
      let errMsg = err.message || 'Could not connect to database endpoint.';
      if (errMsg.toLowerCase().includes('failed to fetch')) {
        errMsg = `XAMPP API connection error: Failed to fetch. [Insecure Content Blocked] - Web browsers block secure HTTPS websites from loading raw HTTP APIs like "${apiUrl}" (Mixed Content). To override this: Click the lock icon in your address bar, go to "Site settings", set "Insecure content" to "Allow" and reload!`;
      }
      setApiError(errMsg);
    } finally {
      setLoadingApi(false);
    }
  }, [useApi, apiUrl]);

  // Synchronous pull on load, state activation, and active interval updates to fix multi-device sync lag
  React.useEffect(() => {
    if (useApi) {
      fetchFromApi();
      const interval = setInterval(() => {
        fetchFromApi();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [useApi, apiUrl, fetchFromApi]);

  // Handle active triggers
  const handleToggleUseApi = (val: boolean) => {
    setUseApi(val);
    localStorage.setItem('cims_use_api', String(val));
  };

  const handleSetApiUrl = (val: string) => {
    setApiUrl(val);
    localStorage.setItem('cims_api_url', val);
  };

  const handleLoginSuccess = (auth: AuthState) => {
    setCurrentAuth(auth);
    localStorage.setItem('cims_session', JSON.stringify(auth));
  };

  const handleLogout = () => {
    setCurrentAuth(null);
    localStorage.removeItem('cims_session');
  };

  // Automatic logout for deleted users or deactivated sessions across devices
  React.useEffect(() => {
    if (!currentAuth) return;

    if (currentAuth.role === 'admin') {
      const stillExists = admins.some(a => a.username.toLowerCase() === currentAuth.username.toLowerCase());
      if (!stillExists) {
        console.warn(`Admin user "${currentAuth.username}" has been deleted from the registry. Logging out.`);
        handleLogout();
      }
    } else if (currentAuth.role === 'cashier') {
      const match = cashiers.find(c => c.username.toLowerCase() === currentAuth.username.toLowerCase());
      if (!match) {
        console.warn(`Cashier user "${currentAuth.username}" has been deleted. Logging out.`);
        handleLogout();
      } else if (match.status === 'inactive') {
        console.warn(`Cashier user "${currentAuth.username}" has been deactivated. Logging out.`);
        handleLogout();
      }
    }
  }, [currentAuth, admins, cashiers]);

  // ADD PRODUCT
  const handleAddProduct = async (newProd: Product) => {
    // 1. Save locally
    const updated = [newProd, ...products];
    setProducts(updated);
    localStorage.setItem('cims_products', JSON.stringify(updated));

    // 2. Synchronize up to the central XAMPP MySQL Database if online sync mode is active
    if (useApi) {
      try {
        const response = await fetch(`${apiUrl}?action=products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            barcode: newProd.barcode,
            brand: newProd.brand || '',
            name: newProd.name,
            ram: newProd.ram || '',
            storageGb: newProd.storageGb || '',
            price: newProd.price,
            costPrice: newProd.costPrice ?? null,
            stock: newProd.stock,
            category: newProd.category,
            description: newProd.description || '',
            warrantyDays: newProd.warrantyDays || null
          })
        });
        const responseText = await response.text();
        let payload: any;
        try {
          payload = JSON.parse(responseText);
        } catch {
          throw new Error(responseText.trim()
            ? `Product API returned HTTP ${response.status}: ${responseText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240)}`
            : `Product save failed with HTTP ${response.status}. If the COGS database columns are missing, run cims\\migrate_cogs.sql in phpMyAdmin and deploy the updated cims\\api.php.`);
        }
        if (!response.ok || payload.status !== 'success') {
          throw new Error(payload.message || `Product save failed with HTTP ${response.status}.`);
        }
        await fetchFromApi();
      } catch (err) {
        console.warn("XAMPP connection failed during product addition:", err);
        await fetchFromApi();
        alert(err instanceof Error ? err.message : 'Product could not be saved to the database.');
      }
    }
  };

  // Add repair ticket
  const handleAddRepairTicket = async (newTicket: RepairTicket) => {
    const updated = [newTicket, ...repairTickets];
    setRepairTickets(updated);
    localStorage.setItem('cims_repair_tickets', JSON.stringify(updated));
    if (useApi) {
      try {
        const response = await fetch(`${apiUrl}?action=repair_tickets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: newTicket.id,
            customerName: newTicket.customerName,
            contact: newTicket.contact,
            device: newTicket.device,
            reportedIssue: newTicket.reportedIssue,
            status: newTicket.status,
            assignedTo: newTicket.assignedTo,
            warrantyStartDate: newTicket.warrantyStartDate,
            warrantyEndDate: newTicket.warrantyEndDate,
            warrantyDays: newTicket.warrantyDays,
            customerAddress: newTicket.customerLocation,
            latitude: newTicket.latitude,
            longitude: newTicket.longitude,
            notes: newTicket.notes,
            createdAt: newTicket.createdAt,
            updatedAt: newTicket.updatedAt
          })
        });
        if (!response.ok) {
          throw new Error(`Repair ticket save failed with HTTP ${response.status}`);
        }
        await fetchFromApi();
      } catch (error) {
        console.warn('XAMPP connection failed during repair ticket creation:', error);
      }
    }
  };

  const handleUpdateRepairTicket = async (updatedTicket: RepairTicket) => {
    const updated = repairTickets.map(ticket => ticket.id === updatedTicket.id ? updatedTicket : ticket);
    setRepairTickets(updated);
    localStorage.setItem('cims_repair_tickets', JSON.stringify(updated));
    if (useApi) {
      try {
        await fetch(`${apiUrl}?action=repair_ticket_update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: updatedTicket.id,
            customerName: updatedTicket.customerName,
            contact: updatedTicket.contact,
            device: updatedTicket.device,
            reportedIssue: updatedTicket.reportedIssue,
            status: updatedTicket.status,
            assignedTo: updatedTicket.assignedTo,
            warrantyStartDate: updatedTicket.warrantyStartDate,
            warrantyEndDate: updatedTicket.warrantyEndDate,
            warrantyDays: updatedTicket.warrantyDays,
            customerAddress: updatedTicket.customerLocation,
            latitude: updatedTicket.latitude,
            longitude: updatedTicket.longitude,
            notes: updatedTicket.notes,
            updatedAt: updatedTicket.updatedAt
          })
        });
        await fetchFromApi();
      } catch (error) {
        console.warn('XAMPP connection failed during repair ticket update:', error);
      }
    }
  };

  const handleDeleteRepairTicket = async (id: string) => {
    const updated = repairTickets.filter(ticket => ticket.id !== id);
    setRepairTickets(updated);
    localStorage.setItem('cims_repair_tickets', JSON.stringify(updated));
    if (useApi) {
      try {
        await fetch(`${apiUrl}?action=repair_ticket_delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        await fetchFromApi();
      } catch (error) {
        console.warn('XAMPP connection failed during repair ticket deletion:', error);
      }
    }
  };

  const handleDeleteRepairTicketsByLocation = async (ids: string[]) => {
    const idsToDelete = new Set(ids);
    const updated = repairTickets.filter(ticket => !idsToDelete.has(ticket.id));
    setRepairTickets(updated);
    localStorage.setItem('cims_repair_tickets', JSON.stringify(updated));

    if (useApi) {
      try {
        await Promise.all(ids.map(id => fetch(`${apiUrl}?action=repair_ticket_delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        })));
        await fetchFromApi();
      } catch (error) {
        console.warn('XAMPP connection failed while deleting repair location records:', error);
      }
    }
  };

  const handleDeleteTransactionsByLocation = async (ids: string[]) => {
    const idsToDelete = new Set(ids);
    const updated = transactions.filter(transaction => !idsToDelete.has(transaction.id));
    setTransactions(updated);
    localStorage.setItem('cims_transactions', JSON.stringify(updated));

    if (useApi) {
      try {
        await Promise.all(ids.map(id => fetch(`${apiUrl}?action=transaction_delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        })));
        await fetchFromApi();
      } catch (error) {
        console.warn('XAMPP connection failed while deleting sales location records:', error);
      }
    }
  };

  const handleAddOperatingExpense = async (expense: OperatingExpense) => {
    if (useApi) {
      const separator = apiUrl.includes('?') ? '&' : '?';
      const response = await fetch(`${apiUrl}${separator}action=operating_expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expense)
      });
      await readOperatingExpenseResponse(response, 'save the operating expense');
    }

    const updated = [expense, ...operatingExpenses];
    setOperatingExpenses(updated);
    localStorage.setItem('cims_operating_expenses', JSON.stringify(updated));
    if (useApi) await fetchFromApi();
  };

  const handleDeleteOperatingExpense = async (id: string) => {
    if (useApi) {
      const separator = apiUrl.includes('?') ? '&' : '?';
      const response = await fetch(`${apiUrl}${separator}action=operating_expense_delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      await readOperatingExpenseResponse(response, 'delete the operating expense');
    }

    const updated = operatingExpenses.filter(expense => expense.id !== id);
    setOperatingExpenses(updated);
    localStorage.setItem('cims_operating_expenses', JSON.stringify(updated));
    if (useApi) await fetchFromApi();
  };

  // Update / Alter parameters
  const handleUpdateProduct = async (updatedProd: Product) => {
    // 1. Update offline memories
    const updated = products.map(p => p.id === updatedProd.id ? updatedProd : p);
    setProducts(updated);
    localStorage.setItem('cims_products', JSON.stringify(updated));

    // 2. Push update upstream to XAMPP API
    if (useApi) {
      try {
        const response = await fetch(`${apiUrl}?action=product_update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: updatedProd.id,
            barcode: updatedProd.barcode,
            brand: updatedProd.brand || '',
            name: updatedProd.name,
            ram: updatedProd.ram || '',
            storageGb: updatedProd.storageGb || '',
            price: updatedProd.price,
            costPrice: updatedProd.costPrice ?? null,
            stock: updatedProd.stock,
            category: updatedProd.category,
            description: updatedProd.description || '',
            warrantyDays: updatedProd.warrantyDays || null
          })
        });
        const responseText = await response.text();
        let payload: any;
        try {
          payload = JSON.parse(responseText);
        } catch {
          throw new Error(responseText.trim()
            ? `Inventory API returned HTTP ${response.status}: ${responseText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240)}`
            : `Inventory save failed with HTTP ${response.status}. If the COGS migration has not been run, apply cims\\migrate_cogs.sql in phpMyAdmin.`);
        }
        if (!response.ok || payload.status !== 'success') {
          throw new Error(payload.message || `Inventory save failed with HTTP ${response.status}.`);
        }
        await fetchFromApi();
      } catch (err) {
        console.warn("XAMPP writeback failed during product updates:", err);
        await fetchFromApi();
        alert(err instanceof Error ? err.message : 'Inventory changes could not be saved to the database.');
      }
    }
  };

  // Delete / Remove discontinued item
  const handleDeleteProduct = async (productId: string) => {
    // 1. Delete locally
    const updated = products.filter(p => p.id !== productId);
    setProducts(updated);
    localStorage.setItem('cims_products', JSON.stringify(updated));

    // 2. Delete from XAMPP central SQL
    if (useApi) {
      try {
        const response = await fetch(`${apiUrl}?action=product_delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: productId })
        });
        if (response.ok) {
          fetchFromApi();
        }
      } catch (err) {
        console.warn("XAMPP writeback failed during product deletion:", err);
      }
    }
  };

  // ADD CASHIER OR UPDATE CASHIER (UPSERT)
  const handleAddCashier = async (newCashier: Cashier) => {
    const exists = cashiers.some(c => c.username.toLowerCase() === newCashier.username.toLowerCase());
    let updated;
    if (exists) {
      updated = cashiers.map(c => c.username.toLowerCase() === newCashier.username.toLowerCase() ? newCashier : c);
    } else {
      updated = [...cashiers, newCashier];
    }
    setCashiers(updated);
    localStorage.setItem('cims_cashiers', JSON.stringify(updated));

    if (useApi) {
      try {
        await fetch(`${apiUrl}?action=add_cashier`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: newCashier.username,
            fullName: newCashier.fullName,
            passwordHash: newCashier.passwordHash,
            status: newCashier.status
          })
        });
        fetchFromApi();
      } catch (e) {
        console.warn("XAMPP add_cashier error:", e);
      }
    }
  };

  // DELETE CASHIER
  const handleDeleteCashier = async (username: string) => {
    if (!useApi) {
      const updated = cashiers.filter(c => c.username.toLowerCase() !== username.toLowerCase());
      setCashiers(updated);
      localStorage.setItem('cims_cashiers', JSON.stringify(updated));
      return;
    }

    try {
      const response = await fetch(`${apiUrl}?action=delete_cashier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() })
      });
      const data = await response.json();
      if (!response.ok || data.status !== 'success') {
        throw new Error(data.message || 'The cashier could not be deleted.');
      }
      await fetchFromApi();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'The cashier could not be deleted.';
      console.warn('XAMPP delete_cashier error:', e);
      alert(message);
    }
  };

  // ADD ADMIN OR UPDATE ADMIN (UPSERT)
  const handleAddAdmin = async (newAdmin: { username: string; fullName: string; passwordHash: string }) => {
    const exists = admins.some(a => a.username.toLowerCase() === newAdmin.username.toLowerCase());
    let updated;
    if (exists) {
      updated = admins.map(a => a.username.toLowerCase() === newAdmin.username.toLowerCase() ? newAdmin : a);
    } else {
      updated = [...admins, newAdmin];
    }
    setAdmins(updated);
    localStorage.setItem('cims_admins', JSON.stringify(updated));

    // If active admin modified their own name, keep the session updated
    if (currentAuth && currentAuth.role === 'admin' && currentAuth.username.toLowerCase() === newAdmin.username.toLowerCase()) {
      const updatedAuth = { ...currentAuth, fullName: newAdmin.fullName };
      setCurrentAuth(updatedAuth);
      localStorage.setItem('cims_session', JSON.stringify(updatedAuth));
    }

    if (useApi) {
      try {
        await fetch(`${apiUrl}?action=add_admin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: newAdmin.username,
            fullName: newAdmin.fullName,
            passwordHash: newAdmin.passwordHash
          })
        });
        fetchFromApi();
      } catch (e) {
        console.warn("XAMPP add_admin warning:", e);
      }
    }
  };

  // DELETE ADMIN
  const handleDeleteAdmin = async (username: string) => {
    const updated = admins.filter(a => a.username !== username);
    setAdmins(updated);
    localStorage.setItem('cims_admins', JSON.stringify(updated));

    if (useApi) {
      try {
        await fetch(`${apiUrl}?action=delete_admin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username })
        });
        fetchFromApi();
      } catch (e) {
        console.warn("XAMPP delete_admin warning:", e);
      }
    }
  };

  // OVERWRITE CASHIER PASSWORD (called by ADMIN)
  const handleResetCashierPassword = async (username: string, newPass: string) => {
    const updated = cashiers.map(c => 
      c.username === username ? { ...c, passwordHash: newPass } : c
    );
    setCashiers(updated);
    localStorage.setItem('cims_cashiers', JSON.stringify(updated));

    if (useApi) {
      try {
        await fetch(`${apiUrl}?action=reset_cashier_password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username,
            newPassword: newPass
          })
        });
        fetchFromApi();
      } catch (e) {
        console.warn("Failed reset cashier password on XAMPP:", e);
      }
    }
  };

  // TOGGLE CASHIER STATUS ACTIVE/INACTIVE
  const handleUpdateCashierStatus = async (username: string, status: 'active' | 'inactive') => {
    const target = cashiers.find(c => c.username === username);
    if (!target) return;

    const updated = cashiers.map(c => 
      c.username === username ? { ...c, status } : c
    );
    setCashiers(updated);
    localStorage.setItem('cims_cashiers', JSON.stringify(updated));

    if (useApi) {
      try {
        await fetch(`${apiUrl}?action=add_cashier`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: target.username,
            fullName: target.fullName,
            passwordHash: target.passwordHash,
            status: status
          })
        });
        fetchFromApi();
      } catch (e) {
        console.warn("XAMPP cashier status push connection warning:", e);
      }
    }
  };

  // LOG CHECKOUT SALE (called by CASHIER POS)
  const handleAddTransaction = async (newTx: Transaction) => {
    // 1. Save Transaction to local state list
    const updatedTxs = [newTx, ...transactions];
    setTransactions(updatedTxs);
    localStorage.setItem('cims_transactions', JSON.stringify(updatedTxs));

    // 2. Reduce Stock sizes locally
    const updatedProducts = products.map(prod => {
      const soldItem = newTx.items.find(item => item.productId === prod.id);
      if (soldItem) {
        return {
          ...prod,
          stock: Math.max(0, prod.stock - soldItem.quantity)
        };
      }
      return prod;
    });

    setProducts(updatedProducts);
    localStorage.setItem('cims_products', JSON.stringify(updatedProducts));

    // 3. Write real-time invoice to central XAMPP MySQL engine
    if (useApi) {
      try {
        const response = await fetch(`${apiUrl}?action=checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: newTx.id,
            cashierUsername: newTx.cashierUsername,
            cashier_username: newTx.cashierUsername,
            cashierName: newTx.cashierName,
            cashier_name: newTx.cashierName,
            subtotal: newTx.subtotal,
            total: newTx.total,
            discount: newTx.discount,
            discount_percentage: newTx.discount,
            paymentReceived: newTx.paymentReceived,
            payment_received: newTx.paymentReceived,
            changeAmount: newTx.changeAmount,
            change_amount: newTx.changeAmount,
            timestamp: newTx.timestamp,
            branch: newTx.branch,
            customerLocation: newTx.customerLocation,
            latitude: newTx.latitude,
            longitude: newTx.longitude,
            items: newTx.items.map(it => ({
              productId: it.productId,
              product_id: it.productId,
              name: it.name,
              product_name: it.name,
              price: it.price,
              costPrice: it.costPrice,
              cost_price: it.costPrice,
              quantity: it.quantity,
              subtotal: it.subtotal,
              warrantyStartDate: it.warrantyStartDate,
              warrantyEndDate: it.warrantyEndDate,
              warranty_start_date: it.warrantyStartDate,
              warranty_end_date: it.warrantyEndDate,
              warrantyDays: it.warrantyDays,
              warranty_days: it.warrantyDays
            }))
          })
        });
        const responseText = await response.text();
        let responseData: any = null;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          // Keep the raw response in the warning when PHP returns non-JSON output.
        }

        if (!response.ok || responseData?.status !== 'success') {
          throw new Error(responseData?.message || `Checkout API returned HTTP ${response.status}: ${responseText.slice(0, 200)}`);
        }

        await fetchFromApi();
      } catch (e) {
        console.warn("XAMPP transaction check-out recording warning:", e);
      }
    }
  };

  // Automatic consolidated backup: save immediately after every data change
  // and again before the browser closes. This keeps the latest order and stock
  // state recoverable from one local backup record.
  React.useEffect(() => {
    const saveBackup = () => {
      try {
        const backup = {
          products,
          cashiers,
          admins,
          transactions,
          repairTickets,
          operatingExpenses,
          session: currentAuth,
          ts: getSSTTimestamp(),
          reason: 'automatic-state-change'
        };
        localStorage.setItem('cims_backup_v1', JSON.stringify(backup));
        localStorage.setItem('cims_last_backup_at', backup.ts);
      } catch (e) {
        console.warn('Failed to write cims backup:', e);
      }
    };

    // Save immediately after the current state has been committed.
    saveBackup();
    window.addEventListener('beforeunload', saveBackup);

    return () => {
      window.removeEventListener('beforeunload', saveBackup);
    };
  }, [products, cashiers, admins, transactions, repairTickets, operatingExpenses, currentAuth]);

  // On startup, if core keys are missing try to restore from backup
  React.useEffect(() => {
    try {
      const missingTx = !localStorage.getItem('cims_transactions');
      const missingProd = !localStorage.getItem('cims_products');
      const missingExpenses = !localStorage.getItem('cims_operating_expenses');
      if (missingTx || missingProd || missingExpenses) {
        const raw = localStorage.getItem('cims_backup_v1');
        if (raw) {
          const b = JSON.parse(raw);
          if (missingTx && Array.isArray(b.transactions) && b.transactions.length > 0) {
            setTransactions(b.transactions);
            localStorage.setItem('cims_transactions', JSON.stringify(b.transactions));
          }
          if (Array.isArray(b.repairTickets) && b.repairTickets.length > 0) {
            setRepairTickets(b.repairTickets);
            localStorage.setItem('cims_repair_tickets', JSON.stringify(b.repairTickets));
          }
          if (missingExpenses && Array.isArray(b.operatingExpenses)) {
            setOperatingExpenses(b.operatingExpenses);
            localStorage.setItem('cims_operating_expenses', JSON.stringify(b.operatingExpenses));
          }
          if (missingProd && Array.isArray(b.products) && b.products.length > 0) {
            setProducts(b.products);
            localStorage.setItem('cims_products', JSON.stringify(b.products));
          }
          if (Array.isArray(b.cashiers) && b.cashiers.length > 0) {
            setCashiers(b.cashiers);
            localStorage.setItem('cims_cashiers', JSON.stringify(b.cashiers));
          }
          if (Array.isArray(b.admins) && b.admins.length > 0) {
            setAdmins(b.admins);
            localStorage.setItem('cims_admins', JSON.stringify(b.admins));
          }
          if (b.session) {
            setCurrentAuth(b.session);
            localStorage.setItem('cims_session', JSON.stringify(b.session));
          }
        }
      }
    } catch (e) {
      console.warn('Backup restore failed:', e);
    }
  }, []);

  // 6. Auth routing check
  if (!currentAuth) {
    return (
      <LoginScreen 
        cashiers={cashiers} 
        admins={admins}
        onLoginSuccess={handleLoginSuccess} 
        useApi={useApi}
        onToggleUseApi={handleToggleUseApi}
        apiUrl={apiUrl}
        onSetApiUrl={handleSetApiUrl}
        onRefreshApi={fetchFromApi}
        loadingApi={loadingApi}
        apiError={apiError}
      />
    );
  }

  if (currentAuth.role === 'admin') {
    return (
      <AdminDashboard
        products={products}
        cashiers={cashiers}
        admins={admins}
        transactions={transactions}
        operatingExpenses={operatingExpenses}
        repairTickets={repairTickets}
        currentAuth={currentAuth}
        onLogout={handleLogout}
        onAddProduct={handleAddProduct}
        onUpdateProduct={handleUpdateProduct}
        onDeleteProduct={handleDeleteProduct}
        onResetCashierPassword={handleResetCashierPassword}
        onUpdateCashierStatus={handleUpdateCashierStatus}
        onAddCashier={handleAddCashier}
        onDeleteCashier={handleDeleteCashier}
        onAddAdmin={handleAddAdmin}
        onDeleteAdmin={handleDeleteAdmin}
        onAddRepairTicket={handleAddRepairTicket}
        onUpdateRepairTicket={handleUpdateRepairTicket}
        onDeleteRepairTicket={handleDeleteRepairTicket}
        onDeleteRepairTicketsByLocation={handleDeleteRepairTicketsByLocation}
        onDeleteTransactionsByLocation={handleDeleteTransactionsByLocation}
        onAddOperatingExpense={handleAddOperatingExpense}
        onDeleteOperatingExpense={handleDeleteOperatingExpense}
        useApi={useApi}
        onToggleUseApi={handleToggleUseApi}
        apiUrl={apiUrl}
        onSetApiUrl={handleSetApiUrl}
        onRefreshApi={fetchFromApi}
        loadingApi={loadingApi}
        apiError={apiError}
      />
    );
  }

  // Fallback / standard route is Cashier POS terminal mode
  return (
    <CashierPOS
      products={products}
      currentAuth={currentAuth}
      onLogout={handleLogout}
      onAddTransaction={handleAddTransaction}
      useApi={useApi}
      onToggleUseApi={handleToggleUseApi}
      apiUrl={apiUrl}
      onSetApiUrl={handleSetApiUrl}
      onRefreshApi={fetchFromApi}
      loadingApi={loadingApi}
      apiError={apiError}
        repairTickets={repairTickets}
        onAddRepairTicket={handleAddRepairTicket}
        onUpdateRepairTicket={handleUpdateRepairTicket}
        onDeleteRepairTicket={handleDeleteRepairTicket}
    />
  );
}
