/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import { 
  Search, Barcode, ShoppingCart, Trash2, Tag, Banknote, 
  RotateCcw, Sparkles, AlertTriangle, LogOut, Printer, 
  CheckCircle, Plus, Minus, Layers, Database, Settings, RefreshCw,
  Wrench
} from 'lucide-react';
import { Product, Transaction, TransactionItem, AuthState, RepairTicket } from '../types';

const getSSTDate = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(date);
  const values: Record<string, string> = {};
  parts.forEach(part => {
    if (part.type !== 'literal') values[part.type] = part.value;
  });

  return `${values.year}-${values.month}-${values.day}`;
};

const getSSTDateOffset = (date = new Date(), daysToAdd: number) => {
  const localLike = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  localLike.setDate(localLike.getDate() + daysToAdd);
  return getSSTDate(localLike);
};

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

const formatPhilippineTimestamp = (value: string) =>
  new Date(value).toLocaleString('en-US', { timeZone: 'Asia/Manila' });

const getPhilippineNow = () =>
  new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));

const geocodeCustomerLocation = async (location: string): Promise<{ latitude: number | null; longitude: number | null }> => {
  const query = location.trim();
  if (!query) return { latitude: null, longitude: null };

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
      { headers: { 'Accept-Language': 'en' } }
    );
    if (!response.ok) throw new Error(`Nominatim returned HTTP ${response.status}`);

    const results: Array<{ lat?: string; lon?: string }> = await response.json();
    const latitude = Number(results[0]?.lat);
    const longitude = Number(results[0]?.lon);
    return {
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null
    };
  } catch (error) {
    console.warn('Customer location geocoding failed:', error);
    return { latitude: null, longitude: null };
  }
};

interface CashierPOSProps {
  products: Product[];
  currentAuth: AuthState;
  onLogout: () => void;
  onAddTransaction: (transaction: Transaction) => void;
  useApi?: boolean;
  onToggleUseApi?: (val: boolean) => void;
  apiUrl?: string;
  onSetApiUrl?: (val: string) => void;
  onRefreshApi?: () => void;
  loadingApi?: boolean;
  apiError?: string | null;
  repairTickets?: RepairTicket[];
  onAddRepairTicket?: (ticket: RepairTicket) => void;
  onUpdateRepairTicket?: (ticket: RepairTicket) => void;
  onDeleteRepairTicket?: (id: string) => void;
}

export default function CashierPOS({ 
  products, 
  currentAuth, 
  onLogout, 
  onAddTransaction,
  useApi = false,
  onToggleUseApi,
  apiUrl = '',
  onSetApiUrl,
  onRefreshApi,
  loadingApi = false,
  apiError = null
  , repairTickets = [], onAddRepairTicket, onUpdateRepairTicket, onDeleteRepairTicket
}: CashierPOSProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [discountAmountInput, setDiscountAmountInput] = useState<string>('');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [customerLocation, setCustomerLocation] = useState('');
  const [geocodingCustomerLocation, setGeocodingCustomerLocation] = useState(false);
  const [repairTicketIdentifier, setRepairTicketIdentifier] = useState('');
  const [lastRepairTicketIdentifier, setLastRepairTicketIdentifier] = useState<string | null>(null);
  const [warrantyEndDate, setWarrantyEndDate] = useState('');
  const [activeTransaction, setActiveTransaction] = useState<Transaction | null>(null);
  const [showDbSettings, setShowDbSettings] = useState(false);
  const [showRepairTicketModal, setShowRepairTicketModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingRepairTicketId, setEditingRepairTicketId] = useState<string | null>(null);
  
  // Custom states for manual barcode helper
  const [manualBarcode, setManualBarcode] = useState('');
  const [barcodeFeedback, setBarcodeFeedback] = useState({ text: '', type: 'info' });

  // Repair ticket form bindings
  const [customerName, setCustomerName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [repairCustomerLocation, setRepairCustomerLocation] = useState('');
  const [repairCustomerPostalCode, setRepairCustomerPostalCode] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [reportedIssue, setReportedIssue] = useState('');
  const [repairStatus, setRepairStatus] = useState<RepairTicket['status']>('open');
  const [repairWarrantyDays, setRepairWarrantyDays] = useState('30');
  const [warrantyStartDate, setWarrantyStartDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [repairNotes, setRepairNotes] = useState('');

  // Warranty helper - calculate status dynamically based on today's date
  const getWarrantyStatus = (warrantyStart?: string, warrantyEnd?: string) => {
    if (!warrantyStart && !warrantyEnd) return { status: 'unknown', label: 'No warranty date set' };
    
    const today = getPhilippineNow();
    const startDate = warrantyStart ? new Date(warrantyStart + 'T00:00:00') : null;
    const endDate = warrantyEnd ? new Date(warrantyEnd + 'T23:59:59') : null;
    
    if (endDate) {
      const isExpired = today > endDate;
      const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return {
        status: isExpired ? 'expired' : 'active',
        label: isExpired ? 'EXPIRED' : `${Math.max(0, daysLeft)}`,
        daysLeft: Math.max(0, daysLeft)
      };
    }
    return { status: 'unknown', label: 'No warranty end date set' };
  };

  // Get active categories
  const categories = useMemo(() => {
    const list = new Set(products.map(p => p.category));
    return ['All', ...Array.from(list)];
  }, [products]);

  // Filtered Products for Catalog
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const cleanSearch = searchTerm.trim().toLowerCase();
      const matchSearch = 
        p.name.toLowerCase().includes(cleanSearch) || 
        p.barcode.includes(cleanSearch) ||
        (p.category && p.category.toLowerCase().includes(cleanSearch));
      return matchCategory && matchSearch;
    });
  }, [products, selectedCategory, searchTerm]);

  // Add Item to Cart
  const handleAddToCart = (product: Product) => {
    if (product.stock <= 0) {
      setBarcodeFeedback({ text: `Cannot add "${product.name}" - Product stands Out of Stock!`, type: 'error' });
      return;
    }

    const existingIndex = cart.findIndex(item => item.product.id === product.id);
    
    if (existingIndex > -1) {
      const currentQty = cart[existingIndex].quantity;
      if (currentQty >= product.stock) {
        setBarcodeFeedback({ text: `Insufficient stock. Only ${product.stock} units available.`, type: 'error' });
        return;
      }
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
    setBarcodeFeedback({ text: `Added ${product.name} to checkout list`, type: 'success' });
  };

  // Adjust cart item quantity
  const handleUpdateQuantity = (productId: string, delta: number) => {
    const targetItem = cart.find(item => item.product.id === productId);
    if (!targetItem) return;

    const newQty = targetItem.quantity + delta;
    if (newQty <= 0) {
      handleRemoveFromCart(productId);
      return;
    }

    if (newQty > targetItem.product.stock) {
      setBarcodeFeedback({ 
        text: `Cannot exceed available physical stock (${targetItem.product.stock} left).`, 
        type: 'error' 
      });
      return;
    }

    setCart(cart.map(item => 
      item.product.id === productId ? { ...item, quantity: newQty } : item
    ));
  };

  // Remove Item from Cart
  const handleRemoveFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  // Clear Cart
  const handleClearCart = () => {
    setCart([]);
    setDiscountAmountInput('');
    setCashReceived('');
    setBarcodeFeedback({ text: 'Active sales cart cleared.', type: 'info' });
  };

  // Handle Manual Barcode Scan Simulation
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualBarcode.trim()) return;

    const foundProduct = products.find(p => p.barcode === manualBarcode.trim());
    if (foundProduct) {
      handleAddToCart(foundProduct);
      setManualBarcode('');
    } else {
      setBarcodeFeedback({ text: `Unknown barcode "${manualBarcode}". Please check product management.`, type: 'error' });
    }
  };

  const handleQuickAddBarcode = (barcode: string) => {
    const foundProduct = products.find(p => p.barcode === barcode);
    if (foundProduct) {
      handleAddToCart(foundProduct);
    }
  };

  // Financial Calculations
  const calculations = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const parsedDiscountAmount = parseFloat(discountAmountInput) || 0;
    const discountAmount = Math.min(subtotal, Math.max(0, parsedDiscountAmount));
    const total = Math.max(0, subtotal - discountAmount);
    
    const parsedReceived = parseFloat(cashReceived) || 0;
    const change = Math.max(0, parsedReceived - total);
    const isPaymentSufficient = parsedReceived >= total && total > 0;

    return {
      subtotal,
      discountAmount,
      total,
      change,
      isPaymentSufficient
    };
  }, [cart, discountAmountInput, cashReceived]);

  // Complete Sale and Create Receipt Invoice
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (cart.length === 0) {
      setBarcodeFeedback({ text: 'Cart is empty. Scan products before final checkout.', type: 'error' });
      return;
    }

    const { total, subtotal, change } = calculations;
    const parsedReceived = parseFloat(cashReceived) || 0;

    if (parsedReceived < total) {
      setBarcodeFeedback({ text: 'Insufficient payment received. Update cashier cash register.', type: 'error' });
      return;
    }

    const normalizedCustomerLocation = customerLocation.trim();
    let latitude: number | null = null;
    let longitude: number | null = null;

    if (normalizedCustomerLocation) {
      setGeocodingCustomerLocation(true);
      const geocodedLocation = await geocodeCustomerLocation(normalizedCustomerLocation);
      setGeocodingCustomerLocation(false);
      latitude = geocodedLocation.latitude;
      longitude = geocodedLocation.longitude;

      if (latitude === null || longitude === null) {
        setBarcodeFeedback({ text: 'Address was not found. Check the customer location and try again.', type: 'error' });
        return;
      }
    }

    // Construct final transaction line items
    const finalItems: TransactionItem[] = cart.map(item => {
      let warrantyStartDate: string | undefined;
      let warrantyEndDate: string | undefined;

      // Calculate warranty dates if product has warranty days
      if (item.product.warrantyDays && item.product.warrantyDays > 0) {
        const today = getSSTDate();
        warrantyStartDate = today;
        warrantyEndDate = getSSTDateOffset(new Date(), item.product.warrantyDays);
      }

      return {
        productId: item.product.id,
        name: item.product.name,
        price: item.product.price,
        costPrice: item.product.costPrice ?? undefined,
        quantity: item.quantity,
        subtotal: item.product.price * item.quantity,
        warrantyDays: item.product.warrantyDays ?? 0,
        warrantyStartDate,
        warrantyEndDate
      };
    });

    // Generate unique index sequence
    const invoiceId = `TX-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 900 + 100)}`;

    const newTx: Transaction = {
      id: invoiceId,
      cashierUsername: currentAuth.username,
      cashierName: currentAuth.fullName,
      items: finalItems,
      discount: calculations.discountAmount,
      subtotal: parseFloat(subtotal.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      paymentReceived: parseFloat(parsedReceived.toFixed(2)),
      changeAmount: parseFloat(change.toFixed(2)),
      timestamp: getSSTTimestamp(),
      customerLocation: normalizedCustomerLocation,
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined
    };

    // Forward to state engine
    onAddTransaction(newTx);
    
    // Set for receipt modal view
    setActiveTransaction(newTx);
    
    // Clear sales registers
    setCart([]);
    setDiscountAmountInput('');
    setCashReceived('');
    setCustomerLocation('');
    setBarcodeFeedback({ text: `Succesfully saved transaction ${invoiceId}`, type: 'success' });
  };

  const handleCloseReceipt = () => {
    setActiveTransaction(null);
  };

  // Repair ticket helpers
  const openAddRepairTicket = () => {
    setModalMode('add');
    setEditingRepairTicketId(null);
    setRepairTicketIdentifier(`RPT-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 900 + 100)}`);
    setCustomerName('');
    setContactInfo('');
    setRepairCustomerLocation('');
    setRepairCustomerPostalCode('');
    setDeviceName('');
    setReportedIssue('');
    setRepairStatus('open');
    setRepairWarrantyDays('30');
    setWarrantyStartDate(getSSTDate());
    setWarrantyEndDate(getSSTDateOffset(new Date(), 30));
    setAssignedTo('');
    setRepairNotes('');
    setShowRepairTicketModal(true);
  };

  const updateRepairWarrantyEndDate = (startDate: string, daysValue: string) => {
    const days = Number.parseInt(daysValue, 10);
    if (!startDate || !Number.isFinite(days) || days <= 0) {
      setWarrantyEndDate('');
      return;
    }
    const endDate = new Date(`${startDate}T00:00:00`);
    endDate.setDate(endDate.getDate() + days);
    setWarrantyEndDate(getSSTDate(endDate));
  };

  const handleRepairTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !repairCustomerLocation.trim() || !deviceName.trim() || !reportedIssue.trim()) {
      setBarcodeFeedback({ text: 'Please fill out the required repair ticket fields.', type: 'error' });
      return;
    }

    const parsedWarrantyDays = Number.parseInt(repairWarrantyDays.trim(), 10);
    const warrantyDays = Number.isFinite(parsedWarrantyDays) && parsedWarrantyDays > 0 ? parsedWarrantyDays : 0;
    const effectiveWarrantyStartDate = warrantyDays > 0 ? (warrantyStartDate || getSSTDate()) : undefined;
    const endDate = effectiveWarrantyStartDate ? new Date(`${effectiveWarrantyStartDate}T00:00:00`) : null;
    if (endDate) endDate.setDate(endDate.getDate() + warrantyDays);
    const effectiveWarrantyEndDate = endDate ? getSSTDate(endDate) : undefined;
    const customerAddress = [repairCustomerLocation.trim(), repairCustomerPostalCode.trim()].filter(Boolean).join(', ');
    const geocodedLocation = await geocodeCustomerLocation(customerAddress);

    if (modalMode === 'add') {
      const newTicket: RepairTicket = {
        id: repairTicketIdentifier || `repair-${Date.now()}`,
        customerName: customerName.trim(),
        contact: contactInfo.trim(),
        device: deviceName.trim(),
        reportedIssue: reportedIssue.trim(),
        status: repairStatus,
        assignedTo: assignedTo.trim(),
        createdAt: getSSTTimestamp(),
        updatedAt: getSSTTimestamp(),
        notes: repairNotes.trim(),
        items: [],
        warrantyDays,
        warrantyStartDate: effectiveWarrantyStartDate,
        warrantyEndDate: effectiveWarrantyEndDate,
        customerLocation: customerAddress,
        customerPostalCode: repairCustomerPostalCode.trim() || undefined,
        latitude: geocodedLocation.latitude ?? undefined,
        longitude: geocodedLocation.longitude ?? undefined
      } as unknown as RepairTicket;
      onAddRepairTicket && onAddRepairTicket(newTicket);
      setLastRepairTicketIdentifier(newTicket.id);
      setBarcodeFeedback({ text: 'Repair ticket created.', type: 'success' });
    } else if (modalMode === 'edit' && editingRepairTicketId) {
      const updatedTicket: RepairTicket = {
        id: editingRepairTicketId,
        customerName: customerName.trim(),
        contact: contactInfo.trim(),
        device: deviceName.trim(),
        reportedIssue: reportedIssue.trim(),
        status: repairStatus,
        assignedTo: assignedTo.trim(),
        createdAt: warrantyStartDate || getSSTTimestamp(),
        updatedAt: getSSTTimestamp(),
        notes: repairNotes.trim(),
        items: [],
        warrantyDays,
        warrantyStartDate: effectiveWarrantyStartDate,
        warrantyEndDate: effectiveWarrantyEndDate,
        customerLocation: customerAddress,
        customerPostalCode: repairCustomerPostalCode.trim() || undefined,
        latitude: geocodedLocation.latitude ?? undefined,
        longitude: geocodedLocation.longitude ?? undefined
      } as unknown as RepairTicket;
      onUpdateRepairTicket && onUpdateRepairTicket(updatedTicket);
      setBarcodeFeedback({ text: 'Repair ticket updated.', type: 'success' });
    }

    setShowRepairTicketModal(false);
  };

  return (
    <div id="cashier-pos-container" className="min-h-screen bg-[#dfeee4] flex flex-col font-sans text-[#102b21]" aria-label="Cashier point of sale">
      
      {/* Top Header Banner bar */}
      <header className="bg-[#0b2e24] text-white py-2.5 px-4 sm:px-6 shadow-[0_8px_24px_rgba(11,46,36,0.18)] border-b border-[#b18a36] flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-[#176044] border border-[#b18a36] p-2 rounded-lg">
            <ShoppingCart className="w-4 h-4 text-[#e9dfbb]" />
          </div>
          <div>
            <span className="font-display font-bold text-base tracking-[0.12em] uppercase">MERIDIAN POS <span className="text-[10px] text-[#e9dfbb] font-mono pl-1">CASHIER TERMINAL</span></span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <button
                type="button"
                onClick={() => setShowDbSettings(true)}
                aria-label={useApi ? 'Database sync is on. Open connection settings.' : 'Local storage mode. Open connection settings.'}
                className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold font-mono tracking-wider transition border ${
                  useApi 
                    ? 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-800/60' 
                    : 'bg-amber-950/80 hover:bg-amber-900 border-amber-800/60 text-amber-300'
                }`}
                title="Configure connection settings"
              >
                {useApi ? "🟢 SYNC ON" : "⚪ LOCAL STORAGE"}
              </button>
            </div>
          </div>
        </div>

        {/* Cashier Metadata */}
        <div className="flex items-center space-x-4">
          <div className="text-right hidden sm:block font-mono">
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">ACTIVE OPERATOR</p>
            <p className="text-xs font-bold text-slate-300">{currentAuth.fullName}</p>
          </div>
          <div className="h-8 w-[1px] bg-slate-800 hidden sm:block"></div>

          <button
            onClick={() => openAddRepairTicket()}
            id="pos-logout-button"
            className="flex items-center justify-center gap-2 px-6 py-2 bg-transparent border-2 border-[#b18a36] text-[#e9dfbb] rounded-md font-semibold text-sm hover:bg-[#b18a36]/15 transition-all"
          >
            <Wrench className="w-3.5 h-3.5" />
            REPAIR
          </button>
                       

          <button
            onClick={onLogout}
            id="pos-logout-button"
            className="flex items-center justify-center gap-2 px-6 py-2 bg-transparent border-2 border-[#b18a36] text-[#e9dfbb] rounded-md font-semibold text-sm hover:bg-[#b18a36]/15 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            Exit POS
          </button>
        </div>
      </header>

      {/* Sync Warning Bar */}
      {!useApi && (
        <div className="bg-amber-500/10 border-b border-amber-500/25 text-amber-900 px-4 py-2 text-[10.5px] font-mono flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
          <span className="flex items-center gap-2 leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span><strong>OFFLINE MODE NOTICE</strong>: Terminal is running in Local Storage sandbox. Checkout transactions will NOT sync to the Live Admin Dashboard reports on Device B.</span>
          </span>
          <button
            onClick={() => setShowDbSettings(true)}
            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 border border-amber-600 text-slate-950 text-[9px] uppercase font-bold rounded tracking-wider transition shrink-0"
          >
            Connect Server
          </button>
        </div>
      )}
     
      {/* Main Core Columns */}
      <div className="flex-1 max-w-[1700px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 p-3 sm:p-4 overflow-visible lg:overflow-hidden">
        
        {/* Left Column: Product Catalog & Search (7 Cols) */}
        <div className="lg:col-span-8 flex flex-col space-y-3">
          
          {/* Barcode scanner & search grid */}
          <section className="bg-[#e9f4ed] p-3 rounded-xl border border-[#a8c8b3] shadow-[0_8px_24px_rgba(11,46,36,0.06)] space-y-3" aria-label="Catalog search and barcode tools">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              
              {/* Name Search Box */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="Search catalog by name or SKU"
                  aria-label="Search catalog by product name"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-[#edf6f0] border border-[#bfd8c7] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#b18a36] focus:bg-white text-xs text-slate-800 transition"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')} 
                    type="button"
                    aria-label="Clear catalog search"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[10px] text-slate-400 hover:text-slate-650 font-bold uppercase"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Barcode Simulator input */}
              <form onSubmit={handleBarcodeSubmit} className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Barcode className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="Scan barcode - Enter"
                  aria-label="Enter barcode to add a product"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  className="w-full pl-9 pr-14 py-2 bg-[#edf6f0] border border-[#bfd8c7] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#b18a36] focus:bg-white text-xs font-mono"
                />
                <button
                  type="submit"
                  aria-label="Scan barcode"
                  className="absolute inset-y-0 right-0 px-3.5 bg-[#e9dfbb] hover:bg-[#b18a36] border-l border-[#bfd8c7] hover:border-[#b18a36] text-[9px] font-bold text-[#6d531d] hover:text-[#0b2e24] rounded-r-lg uppercase transition"
                >
                  Scan
                </button>
              </form>
            </div>

          </section>

          {/* Toast / Scanner Feedback Banner */}
          {barcodeFeedback.text && (
            <div className={`p-2.5 rounded-lg border text-xs font-mono flex items-center justify-between transition-all duration-300 ${
              barcodeFeedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
              barcodeFeedback.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800 font-medium' :
              'bg-blue-50 border-blue-200 text-blue-800'
            }`} role="status" aria-live="polite">
              <div className="flex items-center gap-2 truncate">
                {barcodeFeedback.type === 'error' ? (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                ) : (
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
                )}
                <span className="truncate">{barcodeFeedback.text}</span>
              </div>
              <button 
                onClick={() => setBarcodeFeedback({ text: '', type: 'info' })}
                type="button"
                aria-label="Dismiss scanner feedback"
                className="text-[9px] text-slate-400 hover:text-slate-700 pl-4 uppercase font-bold"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Filtering Category Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 block">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 text-[10px] uppercase font-bold tracking-widest transition whitespace-nowrap rounded-lg ${
                  selectedCategory === cat
                    ? 'bg-[#176044] border border-[#b18a36] text-[#e9dfbb] shadow-sm'
                    : 'bg-[#f5f1e5] text-slate-650 hover:bg-[#dfeee4] border border-[#bfd8c7]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Interactive Products Grid Scroll Area */}
          <div className="bg-[#e9f4ed] rounded-xl border border-[#a8c8b3] overflow-hidden flex-1 flex flex-col shadow-[0_10px_30px_rgba(11,46,36,0.07)]">
            <div className="px-4 py-3.5 border-b border-[#bfd8c7] bg-[#e9f4ed] flex items-center justify-between font-mono">
              <div>
                <span className="text-sm font-bold text-[#176044] uppercase tracking-widest block">Product Catalog</span>
                <span className="text-[10px] text-slate-500">{filteredProducts.length} products available</span>
              </div>
              <span className="text-[9px] text-[#176044] bg-[#dfeee4] border border-[#a8c8b3] px-2.5 py-1 rounded-full font-bold uppercase">Live registry⌄</span>
            </div>

            <div className="p-3 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[55vh] min-h-[18rem] lg:max-h-[600px]">
              {filteredProducts.map(p => {
                const isOutOfStock = p.stock <= 0;
                const isLowStock = p.stock > 0 && p.stock <= 10;
                
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => !isOutOfStock && handleAddToCart(p)}
                    disabled={isOutOfStock}
                    aria-label={`${p.name}, ${p.stock} in stock, ₱${p.price.toFixed(2)}. Add to basket`}
                    className={`relative h-[10rem] min-h-0 overflow-hidden p-3 pb-5 rounded-lg border transition-all duration-150 text-left cursor-pointer flex flex-col ${
                      isOutOfStock 
                        ? 'bg-slate-50 border-slate-200 opacity-55 cursor-not-allowed' 
                        : 'bg-[#f9f7ef] border-[#c9dcd0] hover:border-[#176044] shadow-xs hover:shadow-sm'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-start gap-1 font-mono">
                        <span className="text-[9px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-semibold text-slate-500 uppercase">
                          {p.category}
                        </span>
                        
                        {isOutOfStock ? (
                          <span className="text-[9px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                            No Stock
                          </span>
                        ) : isLowStock ? (
                          <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">
                            {p.stock} Unit{p.stock !== 1 && 's'}
                          </span>
                        ) : (
                          <span className="text-[9px] bg-slate-100 border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                            QTY: {p.stock}
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs font-bold font-display text-slate-900 group-hover:text-indigo-600 line-clamp-2 mt-1">
                        {p.brand && <span className="block text-[10px] text-[#8f702d] uppercase tracking-wider">{p.brand}</span>}
                        {p.name}
                      </h4>
                      {(p.ram || p.storageGb) && (
                        <p className="text-[9px] text-[#176044] font-bold font-mono mt-0.5">
                          {p.ram ? `${p.ram} RAM` : ''}{p.ram && p.storageGb ? ' / ' : ''}{p.storageGb ? `${p.storageGb} ROM` : ''}
                        </p>
                      )}
                      <p className="text-[9px] text-slate-400 font-mono mt-0.5">UPC: {p.barcode}</p>
                    </div>

                    <div className="mt-auto pt-2 pr-10 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-sm font-extrabold text-slate-950 font-mono leading-tight">
                        ₱{p.price.toFixed(2)}
                      </span>
                      <span
                        className={`absolute bottom-3 right-3 p-1.5 transition rounded ${
                          isOutOfStock 
                            ? 'bg-slate-150 text-slate-400' 
                            : 'bg-slate-900 text-white hover:bg-slate-800'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </button>
                );
              })}

              {filteredProducts.length === 0 && (
                <div className="col-span-full py-16 text-center text-slate-400 border border-dashed border-slate-200 rounded-lg">
                  <Layers className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-mono font-bold uppercase text-slate-500">No items match lookup filters.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Adjust Search Criteria.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Checkout cart, calculations & Pay register (5 Cols) */}
        <section className="lg:col-span-4 bg-[#e9f4ed] rounded-xl border border-[#a8c8b3] shadow-[0_10px_30px_rgba(11,46,36,0.08)] flex flex-col overflow-x-hidden overflow-y-auto lg:max-h-[calc(100vh-2rem)] lg:sticky lg:top-4 lg:self-start" aria-labelledby="basket-title">
          
          {/* Cart Header */}
          <div className="bg-[#e9f4ed] border-b border-[#bfd8c7] p-4 flex items-center justify-between font-mono">
            <h2 id="basket-title" className="font-bold text-sm text-[#176044] flex items-center gap-2 uppercase tracking-[0.12em]">
              <ShoppingCart className="w-4 h-4 text-slate-850" />
              Active Basket
              <span className="bg-[#b18a36] text-[#0b2e24] text-[9px] px-2 py-1 rounded-full font-mono font-bold">
                {cart.reduce((s, i) => s + i.quantity, 0)} Items
              </span>
            </h2>
            <button
              onClick={handleClearCart}
              disabled={cart.length === 0}
              className="text-[10px] uppercase font-bold tracking-wider text-rose-650 hover:text-rose-800 disabled:text-slate-300 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All
            </button>
          </div>

          {/* Cart items list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-[220px]">
            {cart.map(item => (
              <div 
                key={item.product.id}
                className="flex items-center justify-between p-3 bg-slate-50/50 rounded-lg border border-slate-205 text-xs gap-3"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold font-display text-slate-905 truncate">{item.product.name}</h4>
                  {(item.product.ram || item.product.storageGb) && (
                    <p className="text-[9px] text-[#176044] font-bold font-mono mt-0.5">
                      {item.product.ram ? `${item.product.ram} RAM` : ''}{item.product.ram && item.product.storageGb ? ' / ' : ''}{item.product.storageGb ? `${item.product.storageGb} ROM` : ''}
                    </p>
                  )}
                  <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                    Unit: ₱{item.product.price.toFixed(2)} | Avail: {item.product.stock}
                  </p>
                  {item.product.warrantyDays && item.product.warrantyDays > 0 && (
                    <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-slate-100 text-slate-700 px-2 py-1 text-[9px] font-bold uppercase tracking-wide border border-slate-200">
                      {(() => {
                        const warrantyStart = getSSTDate();
                        const warrantyEnd = getSSTDateOffset(new Date(), item.product.warrantyDays ?? 0);
                        const status = getWarrantyStatus(warrantyStart, warrantyEnd);
                        return status.status === 'active' ? (
                          <span className="text-emerald-700">{status.label}</span>
                        ) : (
                          <span className="text-rose-700">{status.label}</span>
                        );
                      })()}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Quantity adjust buttons */}
                  <div className="flex items-center border border-slate-200 rounded bg-white overflow-hidden shadow-xs">
                    <button
                      onClick={() => handleUpdateQuantity(item.product.id, -1)}
                      className="p-1 hover:bg-slate-50 text-slate-500"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="px-2 font-mono font-bold text-slate-800 min-w-[20px] text-center text-xs">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleUpdateQuantity(item.product.id, 1)}
                      className="p-1 hover:bg-slate-50 text-slate-500"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Subtotal price for item */}
                  <div className="text-right min-w-[55px] font-mono font-bold text-slate-950">
                    ₱{(item.product.price * item.quantity).toFixed(2)}
                  </div>

                  {/* Remove single item button */}
                  <button
                    onClick={() => handleRemoveFromCart(item.product.id)}
                    className="text-slate-400 hover:text-rose-600 p-1 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {cart.length === 0 && (
              <div className="h-full flex flex-col justify-center items-center text-[#7c9b8b] py-12">
                <div className="p-3 bg-[#dfeee4] border border-[#bfd8c7] rounded-xl mb-3 text-[#176044]">
                  <Barcode className="w-8 h-8" />
                </div>
                <p className="text-sm font-display font-bold text-[#176044]">Your basket is empty</p>
                <p className="text-[11px] text-[#7c9b8b] text-center max-w-[220px] mt-1 pr-1 pl-1">
                  Select a product from the catalog to start an order.
                </p>
              </div>
            )}
          </div>

          {/* Calculator Totals & Discount/Payments Block */}
          <div className="bg-slate-50 border-t border-slate-200 p-4 space-y-4 font-mono text-sm">
            
            {/* Custom discount input */}
            <div className="pb-2 border-b border-dashed border-slate-200">
              <label htmlFor="pos-discount-input" className="text-xs uppercase font-bold text-slate-700 flex items-center gap-1 font-mono">
                <Tag className="w-3 h-3 text-slate-500" /> DISCOUNT AMOUNT (₱)
              </label>
              <div className="relative mt-1.5 max-w-xs">
                <input
                  id="pos-discount-input"
                  type="number"
                  min="0"
                  max={calculations.subtotal}
                  step="0.01"
                  value={discountAmountInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      setDiscountAmountInput('');
                      return;
                    }
                    const parsedValue = Number(value);
                    if (Number.isFinite(parsedValue)) {
                      setDiscountAmountInput(String(Math.min(calculations.subtotal, Math.max(0, parsedValue))));
                    }
                  }}
                  aria-describedby="pos-discount-help"
                  className="w-full pl-8 pr-3 py-2 bg-white border border-slate-205 rounded-lg font-mono font-bold text-base text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 font-bold">₱</span>
              </div>
              <p id="pos-discount-help" className="mt-1 text-[11px] text-slate-500">Enter a peso amount up to the subtotal.</p>
            </div>

            {/* Calculations summaries */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-slate-650">
                <span>SUBTOTAL:</span>
                <span className="font-bold">₱{calculations.subtotal.toFixed(2)}</span>
              </div>
              
              {calculations.discountAmount > 0 && (
                <div className="flex justify-between text-rose-700 font-medium font-bold">
                  <span>DISCOUNT DEDUCTION:</span>
                  <span>-₱{calculations.discountAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-xl font-black text-slate-950 pt-3 border-t border-slate-200 font-display">
                <span>GRAND TOTAL:</span>
                <span className="font-mono">₱{calculations.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Checkout Payment validation Form */}
            <form onSubmit={handleCheckoutSubmit} className="space-y-3 pt-1">
              
              <div className="grid gap-3">
                <div className="space-y-1">
                  <label className="text-xs uppercase font-bold text-slate-700 block font-mono" htmlFor="pos-customer-location">Customer address / location</label>
                  <input
                    id="pos-customer-location"
                    type="text"
                    placeholder="Street, city, district, or postal code"
                    value={customerLocation}
                    onChange={(event) => setCustomerLocation(event.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-205 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs uppercase font-bold text-slate-700 block font-mono">Cash Received from Customer</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 font-bold font-mono text-xs">
                      ₱
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      id="pos-payment-cash-input"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      className="w-full pl-6 pr-3 py-2 bg-white border border-slate-205 rounded-lg font-mono font-bold text-base text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic change display block */}
              {parseFloat(cashReceived) > 0 && (
                <div className={`p-2.5 rounded-lg border flex justify-between items-center font-mono ${
                  calculations.isPaymentSufficient 
                    ? 'bg-emerald-50 border-emerald-150 text-emerald-850' 
                    : 'bg-rose-50 border-rose-150 text-rose-850'
                }`} role="status" aria-live="polite">
                  <span className="text-[10px] uppercase font-bold">
                    {calculations.isPaymentSufficient ? 'Change due' : 'Incomplete payment'}
                  </span>
                  <span className="text-base font-bold">
                    ₱{(calculations.isPaymentSufficient ? calculations.change : (calculations.total - (parseFloat(cashReceived) || 0))).toFixed(2)}
                  </span>
                </div>
              )}

              {/* Core trigger checkout cash-out button */}
              <div className="sticky bottom-0 z-10 -mx-1 px-1 pt-2 pb-1 bg-slate-50/95 backdrop-blur-sm border-t border-slate-200">
                <button
                  type="submit"
                  id="pos-submit-sale-button"
                  disabled={cart.length === 0 || !calculations.isPaymentSufficient || geocodingCustomerLocation}
                  className={`w-full min-h-[3.5rem] py-3 px-4 font-bold text-base uppercase tracking-wider rounded-lg text-center shadow-xs transition flex items-center justify-center gap-2 ${
                    cart.length > 0 && calculations.isPaymentSufficient
                      ? 'bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white cursor-pointer hover:shadow-xs active:scale-98'
                      : 'bg-slate-200 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  {geocodingCustomerLocation ? 'Locating Customer Address...' : 'Commit Order & Print Receipt'}
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>

      {/* POS Receipt Invoice Modal dialog (Triggered on successful checkout) */}
      {activeTransaction && (
        <div id="receipt-modal-view" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="receipt-modal-title">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-sm shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header Success visual banner */}
            <div className="bg-slate-900 text-white p-5 text-center space-y-1.5 flex flex-col items-center border-b border-slate-800">
              <div className="p-2.5 bg-slate-850 border border-slate-750 rounded-lg">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <h3 id="receipt-modal-title" className="text-base font-display font-semibold uppercase tracking-wider">Checkout Confirmed</h3>
              <p className="text-[10.5px] font-mono text-slate-400">RECEIPT NO: {activeTransaction.id}</p>
              {lastRepairTicketIdentifier && (
                <p className="text-[10.5px] font-mono text-slate-400">REPAIR TICKET NO: {lastRepairTicketIdentifier}</p>
              )}
            </div>

            {/* Printable Area styling */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 font-mono text-xs text-slate-700">
              {/* Store Title */}
              <div className="text-center space-y-1 pb-4 border-b border-dashed border-slate-250">
                <h4 className="text-[11px] font-bold text-slate-950 tracking-widest uppercase">CCAS MOBITRACK</h4>
                <p className="text-[10px] text-slate-450">CCAS MOBITRACK Session</p>
                <p className="text-[10px] text-slate-450">Date: {formatPhilippineTimestamp(activeTransaction.timestamp)}</p>
              </div>

              {/* Cashier name details */}
              <div className="flex justify-between">
                <span>Cashier Operator:</span>
                <span className="font-bold text-slate-900">{activeTransaction.cashierName}</span>
              </div>

              {/* Items listing table representation */}
              <div className="border-b border-dashed border-slate-250 pb-3.5 space-y-2 pt-1.5">
                <div className="grid grid-cols-12 text-[10px] font-bold text-slate-500 uppercase pb-1">
                  <span className="col-span-6">Product</span>
                  <span className="col-span-2 text-center">Qty</span>
                  <span className="col-span-4 text-right">Price</span>
                </div>
                
                {activeTransaction.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 leading-relaxed text-[11px]">
                    <span className="col-span-6 truncate text-slate-800">
                    <div className="font-semibold">{item.name}</div>
                    {item.warrantyStartDate && item.warrantyEndDate && (
                      <div className="text-[9px] text-slate-500 mt-1">
                        {(() => {
                          const status = getWarrantyStatus(item.warrantyStartDate, item.warrantyEndDate);
                          return (
                            <span className={status.status === 'active' ? 'text-emerald-700' : 'text-rose-700'}>
                              {status.label}
                            </span>
                          );
                        })()}
                      </div>
                    )}
                  </span>
                    <span className="col-span-2 text-center text-slate-650">{item.quantity}</span>
                    <span className="col-span-4 text-right text-slate-900">₱{item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Ledger Summary totals block */}
              <div className="space-y-1.5 border-b border-dashed border-slate-250 pb-3">
                <div className="flex justify-between">
                  <span>SUBTOTAL:</span>
                  <span>₱{activeTransaction.subtotal.toFixed(2)}</span>
                </div>
                {activeTransaction.discount > 0 && (
                  <div className="flex justify-between text-rose-705 font-bold">
                    <span>DISCOUNT:</span>
                    <span>-₱{activeTransaction.discount.toFixed(2)}</span>
                  </div>
                )}
                {activeTransaction.additionalCharge && activeTransaction.additionalCharge > 0 && (
                  <div className="flex justify-between text-slate-650 font-bold">
                    <span>ADDITIONAL CHARGE:</span>
                    <span>₱{activeTransaction.additionalCharge.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-bold text-slate-950 pt-1.5">
                  <span>GRAND TOTAL PAID:</span>
                  <span className="text-sm font-black">₱{activeTransaction.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Tender payment detailed changes */}
              <div className="space-y-1 bg-slate-50 p-2 rounded border border-slate-100">
                <div className="flex justify-between">
                  <span>Cash Tendered:</span>
                  <span className="font-bold text-slate-900">₱{activeTransaction.paymentReceived.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-800 pb-0.5">
                  <span>Change Dispelled:</span>
                  <span className="font-black">₱{activeTransaction.changeAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Warm message footer */}
              <div className="text-center pt-4 text-[10px] text-slate-400 space-y-1 uppercase tracking-wider font-mono">
                <p>Purchases Recorded successfully.</p>
                <p className="font-bold text-slate-600">*** local inventory synchronized ***</p>
              </div>
            </div>

            {/* Print and complete controls */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2 px-3 border border-slate-205 hover:bg-slate-100 rounded-lg text-slate-700 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <Printer className="w-3.5 h-3.5" />
                Print List
              </button>
              <button
                type="button"
                onClick={handleCloseReceipt}
                id="receipt-modal-close"
                className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                Next Order
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Database Connection Settings Modal overlay */}
      {showDbSettings && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4" id="db-settings-modal" role="dialog" aria-modal="true" aria-labelledby="db-settings-title">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full border border-slate-205 overflow-hidden flex flex-col justify-between">
            <header className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-400" />
                <h3 id="db-settings-title" className="font-display font-semibold text-xs tracking-tight uppercase font-mono">Terminal Sync Link</h3>
              </div>
              <button
                onClick={() => setShowDbSettings(false)}
                className="text-slate-400 hover:text-white transition text-sm font-bold p-1 focus:outline-none"
              >
                ✕
              </button>
            </header>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed font-sans">
                By default, this cashier terminal stores registers in local memory storage. To synchronize sales and stock levels to a shared central MySQL database (Device B's database), activate the live XAMPP database link.
              </p>

              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="space-y-0.5">
                  <span className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                    DATABASE SYNC
                  </span>
                  <span className="text-[11px] font-semibold text-slate-800">
                    {useApi ? "LIVE XAMPP DB" : "LOCAL SANDBOX"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleUseApi && onToggleUseApi(!useApi)}
                  className={`py-1.5 px-3 rounded text-[10px] font-mono font-bold uppercase transition tracking-wider ${
                    useApi 
                      ? 'bg-amber-500 hover:bg-amber-600 border border-amber-600 text-slate-950' 
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {useApi ? "DISCONNECT" : "CONNECT LINK"}
                </button>
              </div>

              {useApi && (
                <div className="space-y-2">
                  <label className="block text-[9px] font-mono font-bold text-slate-600 uppercase tracking-wider">
                    XAMPP API Web Address (api.php)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={apiUrl}
                      onChange={(e) => onSetApiUrl && onSetApiUrl(e.target.value)}
                      placeholder="e.g. http://192.168.1.100/cims/api.php"
                      className="flex-1 px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded focus:border-slate-500 focus:outline-none shadow-inner"
                    />
                    <button
                      onClick={onRefreshApi}
                      disabled={loadingApi}
                      className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-mono font-bold disabled:bg-slate-300 transition flex items-center gap-1 shrink-0"
                    >
                      {loadingApi ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        'TEST'
                      )}
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-400 font-sans leading-relaxed">
                    💡 Replace <code className="bg-slate-100 py-0.5 px-1 rounded text-slate-800 font-mono">localhost</code> with Device B's <strong>Local IP Address</strong> (e.g. <code className="bg-slate-100 py-0.5 px-1 font-mono text-slate-800">192.168.1.50</code>) so that this terminal can find the shared database!
                  </p>
                </div>
              )}

              {/* Error messages */}
              {useApi && apiError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-950 rounded text-[11px] leading-relaxed font-sans mt-2 space-y-2">
                  <div>
                    <span className="font-bold uppercase tracking-wider font-mono text-[9px] text-red-800 block mb-0.5">Connection Error:</span>
                    <div className="font-mono text-[10px] bg-red-100/50 p-1.5 rounded" id="db-settings-error">{apiError}</div>
                  </div>

                  {window.location.protocol === 'https:' && apiUrl.toLowerCase().startsWith('http://') && (
                    <div className="bg-amber-150/80 p-2.5 rounded border border-amber-300 text-amber-950 text-[10px] space-y-1.5 leading-normal">
                      <p className="font-bold uppercase tracking-wider font-mono text-[9px] text-amber-800 flex items-center gap-1">
                        ⚠️ Browser Block (HTTPS secure constraint)
                      </p>
                      <p>
                        This page is safe **HTTPS**, but your XAMPP IP is insecure **HTTP**. Direct loading is blocked.
                      </p>
                      <ul className="list-disc pl-3.5 space-y-1">
                        <li><strong>Chrome/Edge Tip</strong>: Click the setting sliders next to the address input bar &gt; open <strong>Site settings</strong> &gt; allow <strong>Insecure content</strong> &gt; refetch!</li>
                        <li><strong>Tunnel Tip</strong>: Install <strong>ngrok</strong> and execute <code className="bg-amber-200/60 font-mono px-0.5">ngrok http 80</code> for a secure <code className="font-mono font-bold">https://</code> base address.</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {useApi && !apiError && !loadingApi && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-205 text-emerald-950 rounded text-[11px] leading-relaxed flex items-center justify-center gap-1.5 font-sans mt-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium text-[10.5px]">Connected successfully. Real-time multi-device sync active.</span>
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-3 border-t border-slate-200 text-right">
              <button
                onClick={() => setShowDbSettings(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 rounded text-xs font-mono font-bold text-slate-700 transition"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

            {showRepairTicketModal && (
                    <div id="repair-ticket-modal" className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="repair-ticket-modal-title">
                <div className="bg-white rounded-lg border border-slate-300 w-full max-w-md shadow-2xl overflow-hidden animate-fade max-h-[calc(100vh-4rem)]">
                  
                  {/* Header banner */}
                  <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center border-b border-slate-950">
                    <h3 id="repair-ticket-modal-title" className="font-bold font-mono text-[10px] tracking-wider uppercase">
                      {modalMode === 'add' ? 'Create Repair Ticket' : 'Edit Repair Ticket'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowRepairTicketModal(false)}
                      className="text-slate-400 hover:text-white font-mono uppercase tracking-wider text-[9px] font-bold"
                    >
                      [ Close ]
                    </button>
                  </div>
      
                  <form onSubmit={handleRepairTicketSubmit} className="p-5 space-y-4 max-h-[calc(100vh-14rem)] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 space-y-1">
                        <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">Ticket Identifier</label>
                        <input
                          type="text"
                          readOnly
                          value={repairTicketIdentifier}
                          className="w-full py-2 px-3 border border-slate-205 rounded bg-slate-50 text-xs font-mono text-slate-600"
                        />
                      </div>
      
                      <div className="col-span-2 space-y-1">
                        <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">Customer Name</label>
                        <input
                          type="text"
                          required
                          placeholder="Juan Dela Cruz"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-sans placeholder:opacity-50"
                        />
                      </div>
      
                      <div className="col-span-2 space-y-1">
                        <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">Contact Number / Email</label>
                        <input
                          type="text"
                          placeholder="09XXXXXXXXX or customer@example.com"
                          value={contactInfo}
                          onChange={(e) => setContactInfo(e.target.value)}
                          className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-mono placeholder:opacity-50"
                        />
                      </div>

                      <div className="col-span-1 space-y-1">
                        <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">Customer Address</label>
                        <input
                          type="text"
                          required
                          placeholder="Address or place name"
                          value={repairCustomerLocation}
                          onChange={(e) => setRepairCustomerLocation(e.target.value)}
                          className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-sans placeholder:opacity-50"
                        />
                      </div>

                      <div className="col-span-1 space-y-1">
                        <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">Postal Code</label>
                        <input
                          type="text"
                          placeholder="e.g., 1600"
                          value={repairCustomerPostalCode}
                          onChange={(e) => setRepairCustomerPostalCode(e.target.value)}
                          className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-mono placeholder:opacity-50"
                        />
                      </div>
      
                      <div className="col-span-1 space-y-1">
                        <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">Device</label>
                        <input
                          type="text"
                          required
                          placeholder="Laptop / Smartphone / Printer"
                          value={deviceName}
                          onChange={(e) => setDeviceName(e.target.value)}
                          className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-mono placeholder:opacity-50"
                        />
                      </div>
      
                      <div className="col-span-1 space-y-1">
                        <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">Progress</label>
                        <select
                          value={repairStatus}
                          onChange={(e) => setRepairStatus(e.target.value as RepairTicket['status'])}
                          className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs text-slate-700 font-mono uppercase"
                        >
                          <option value="open">OPEN</option>
                          <option value="in_progress">IN PROGRESS</option>
                          <option value="completed">COMPLETED</option>
                          <option value="closed">CLOSED</option>
                        </select>
                      </div>
      
                      <div className="col-span-1 space-y-1">
                        <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">Warranty Duration (Days)</label>
                        <input
                          type="number"
                          min="0"
                          value={repairWarrantyDays}
                          onChange={(e) => {
                            setRepairWarrantyDays(e.target.value);
                            updateRepairWarrantyEndDate(warrantyStartDate, e.target.value);
                          }}
                          className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-mono"
                        />
                      </div>

                      <div className="col-span-1 space-y-1">
                        <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">Warranty Start Date</label>
                        <input
                          type="date"
                          value={warrantyStartDate}
                          onChange={(e) => {
                            setWarrantyStartDate(e.target.value);
                            updateRepairWarrantyEndDate(e.target.value, repairWarrantyDays);
                          }}
                          className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-mono"
                        />
                      </div>

                      <div className="col-span-2 space-y-1">
                        <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">Reported Issue</label>
                        <textarea
                          rows={2}
                          required
                          placeholder="Describe the customer problem or malfunction..."
                          value={reportedIssue}
                          onChange={(e) => setReportedIssue(e.target.value)}
                          className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-sans placeholder:opacity-50"
                        />
                      </div>
      
                      <div className="col-span-2 space-y-1">
                        <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">Progress / Assigned To</label>
                        <input
                          type="text"
                          placeholder="Technician or progress summary"
                          value={assignedTo}
                          onChange={(e) => setAssignedTo(e.target.value)}
                          className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-mono placeholder:opacity-50"
                        />
                      </div>
                    </div>
      
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">Repair Notes (Optional)</label>
                      <textarea
                        rows={2}
                        placeholder="Additional notes for follow-up or warranty checks..."
                        value={repairNotes}
                        onChange={(e) => setRepairNotes(e.target.value)}
                        className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-sans placeholder:opacity-50"
                      />
                    </div>
      
                    <div className="flex gap-2 pt-4 border-t border-slate-200 text-[10px] font-mono uppercase tracking-wider">
                      <button
                        type="button"
                        onClick={() => setShowRepairTicketModal(false)}
                        className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded text-center transition border border-slate-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded text-center transition border border-slate-950"
                      >
                        {modalMode === 'add' ? 'Create Ticket' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

    </div>
  );
}
