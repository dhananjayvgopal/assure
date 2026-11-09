/**
 * Garment Product & Multi-Variant Management View
 * Manage style codes, sizes, colors, cost vs retail prices,
 * SKU codes, barcodes, and variant-level stock.
 */

import React, { useState, useMemo } from 'react';
import { usePOS } from '../../context/POSContext';
import { garmentColorHex, STANDARD_GARMENT_COLORS } from '../../utils/garmentColor';
import { getGstRate } from '../../utils/gst';
import { GarmentProduct, GarmentVariant } from '../../types/pos';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Barcode,
  Download,
  X,
  ChevronDown,
  ChevronRight,
  Layers,
  Check,
} from 'lucide-react';

export const ProductManagementView: React.FC = () => {
  const {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    settings,
    hasPermission,
  } = usePOS();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  // Add / Edit Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState<GarmentProduct['category']>('Shirts');
  const [styleCode, setStyleCode] = useState('');
  const [gender, setGender] = useState<GarmentProduct['gender']>('Unisex');
  const [material, setMaterial] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [taxRate, setTaxRate] = useState(settings.taxRateDefault);
  const [notes, setNotes] = useState('');

  // Variant generator fields
  const [selectedSizes, setSelectedSizes] = useState<string[]>(['S', 'M', 'L']);
  const [selectedColors, setSelectedColors] = useState<string[]>(['White', 'Navy']);
  const [customColorInput, setCustomColorInput] = useState('');
  const [customColors, setCustomColors] = useState<string[]>([]);
  const [baseCost, setBaseCost] = useState<number>(500);
  const [basePrice, setBasePrice] = useState<number>(1499);
  const [initialStockPerVariant, setInitialStockPerVariant] = useState<number>(10);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.styleCode.toLowerCase().includes(q) ||
        (p.hsnCode && p.hsnCode.includes(q)) ||
        p.variants.some((v) => v.sku.toLowerCase().includes(q) || v.barcode.includes(q))
      );
    });
  }, [products, searchQuery, categoryFilter]);

  // Open modal for adding
  const handleOpenAdd = () => {
    setEditingProductId(null);
    setName('');
    setBrand('');
    setCategory('Shirts');
    setStyleCode(`ST-${Math.floor(100 + Math.random() * 900)}`);
    setGender('Unisex');
    setMaterial('100% Cotton');
    setHsnCode('');
    setTaxRate(settings.taxRateDefault);
    setNotes('');
    setSelectedSizes(['S', 'M', 'L']);
    setSelectedColors(['White', 'Navy']);
    setCustomColorInput('');
    setCustomColors([]);
    setBaseCost(500);
    setBasePrice(1499);
    setInitialStockPerVariant(10);
    setIsAddModalOpen(true);
  };

  // Open modal for editing
  const handleOpenEdit = (prod: GarmentProduct) => {
    setEditingProductId(prod.id);
    setName(prod.name);
    setBrand(prod.brand);
    setCategory(prod.category);
    setStyleCode(prod.styleCode);
    setGender(prod.gender);
    setMaterial(prod.material);
    setHsnCode(prod.hsnCode || '');
    setTaxRate(prod.taxRate ?? settings.taxRateDefault);
    setNotes(prod.notes || '');
    setIsAddModalOpen(true);
  };

  // Handle Form Submit
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (settings.registrationType !== 'unregistered' && !/^\d{4}(\d{2}(\d{2})?)?$/.test(hsnCode)) {
      alert('Enter a valid 4, 6, or 8 digit HSN code before saving this product.');
      return;
    }
    if (hsnCode && !/^\d{4}(\d{2}(\d{2})?)?$/.test(hsnCode)) {
      alert('Enter a valid 4, 6, or 8 digit HSN code, or leave it blank.');
      return;
    }
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      alert('Enter a GST rate between 0 and 100 percent.');
      return;
    }

    if (editingProductId) {
      // Update existing
      updateProduct(editingProductId, {
        name,
        brand,
        category,
        styleCode,
        gender,
        material,
        hsnCode,
        taxRate,
        notes,
      });
    } else {
      // Build variants from generator
      const colors = [...selectedColors, ...customColors];
      if (!colors.length) {
        alert('Select at least one garment color.');
        return;
      }

      const generatedVariants: GarmentVariant[] = [];
      const codePrefix = styleCode.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'GAR';

      let vCounter = 1;
      colors.forEach((col) => {
        selectedSizes.forEach((sz) => {
          const colCode = col.slice(0, 3).toUpperCase();
          const sku = `${codePrefix}-${colCode}-${sz}`;
          const barcode = `89${Math.floor(10000000 + Math.random() * 90000000)}`;

          generatedVariants.push({
            id: `v-${Date.now()}-${vCounter++}`,
            productId: '',
            sku,
            barcode,
            size: sz,
            color: col,
            colorHex: getColorHex(col),
            costPrice: baseCost,
            sellingPrice: basePrice,
            stock: initialStockPerVariant,
            minStockThreshold: 3,
            location: 'Main Floor',
          });
        });
      });

      addProduct({
        name,
        category,
        brand,
        styleCode,
        gender,
        material,
        hsnCode,
        taxRate,
        variants: generatedVariants,
        notes,
      });
    }

    setIsAddModalOpen(false);
  };

  // Helper color map
  const getColorHex = (name: string): string => {
    return garmentColorHex(name, undefined, '#A3A3A3');
  };

  // Export catalog to CSV
  const handleExportCSV = () => {
    const rows = [
      ['Product ID', 'Garment Name', 'Category', 'Brand', 'Style Code', 'Gender', 'SKU', 'Barcode', 'Size', 'Color', 'Cost Price', 'Selling Price', 'Stock', 'Location']
    ];

    products.forEach((p) => {
      p.variants.forEach((v) => {
        rows.push([
          p.id,
          `"${p.name.replace(/"/g, '""')}"`,
          p.category,
          p.brand,
          p.styleCode,
          p.gender,
          v.sku,
          v.barcode,
          v.size,
          v.color,
          v.costPrice.toFixed(2),
          v.sellingPrice.toFixed(2),
          v.stock.toString(),
          v.location || '',
        ]);
      });
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `garment_catalog_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const categories = ['all', 'Shirts', 'Trousers', 'Denim', 'Dresses', 'Knitwear', 'Outerwear', 'Basics', 'Accessories'];
  const standardSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '28', '30', '32', '34', '36', '38'];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Title & Actions Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-stone-200">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Garment Catalog & Variants</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Manage garment styles, size/color variant combinations, prices, and barcodes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 rounded transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          {hasPermission('products.manage') && (
            <button
              onClick={handleOpenAdd}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Garment</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, SKU, style or barcode..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-stone-300 rounded focus:outline-hidden focus:border-stone-800"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 text-xs font-medium rounded capitalize cursor-pointer whitespace-nowrap shrink-0 ${
                categoryFilter === cat
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {cat === 'all' ? 'All' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Garments & Variants List */}
      <div className="bg-white border border-stone-200 rounded overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="p-8 text-center text-stone-400 text-xs">
            No garments match the current query.
          </div>
        ) : (
          <div className="divide-y divide-stone-200">
            {filteredProducts.map((prod) => {
              const isExpanded = expandedProductId === prod.id;
              const totalStock = prod.variants.reduce((sum, v) => sum + v.stock, 0);
              const minPrice = Math.min(...prod.variants.map((v) => v.sellingPrice));
              const maxPrice = Math.max(...prod.variants.map((v) => v.sellingPrice));

              return (
                <div key={prod.id} className="transition-colors hover:bg-stone-50/60">
                  {/* Master Garment Row */}
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => setExpandedProductId(isExpanded ? null : prod.id)}
                        className="text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
                        title={isExpanded ? 'Collapse variants' : 'Expand variants'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-stone-700" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-stone-900 truncate">
                            {prod.name}
                          </h4>
                          <span className="font-mono text-[11px] text-stone-400">
                            [{prod.styleCode}]
                          </span>
                          <span className="font-mono text-[10.5px] bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.5 rounded font-semibold">
                            HSN: {prod.hsnCode || '6205'}
                          </span>
                        </div>

                        {/* Unboxed metadata: Category · Gender · Material */}
                        <div className="text-xs text-stone-500 mt-0.5">
                          <span>{prod.brand}</span>
                          <span aria-hidden="true" className="mx-1">·</span>
                          <span>{prod.category}</span>
                          <span aria-hidden="true" className="mx-1">·</span>
                          <span className="font-mono font-medium text-stone-700">HSN {prod.hsnCode || '6205'}</span>
                          <span aria-hidden="true" className="mx-1">·</span>
                          <span>{prod.gender}</span>
                          <span aria-hidden="true" className="mx-1">·</span>
                          <span>{prod.material}</span>
                        </div>
                      </div>
                    </div>

                    {/* Stock and Price stats */}
                    <div className="flex items-center gap-6 shrink-0 text-right">
                      <div>
                        <span className="text-[11px] text-stone-400 block">Retail Range</span>
                        <span className="font-mono font-bold text-xs text-stone-900 tabular-nums">
                          {settings.currencySymbol}{minPrice.toFixed(2)} - {settings.currencySymbol}{maxPrice.toFixed(2)}
                        </span>
                      </div>

                      <div>
                        <span className="text-[11px] text-stone-400 block">Variants</span>
                        <span className="font-mono text-xs text-stone-700">
                          {prod.variants.length} sizes/colors
                        </span>
                      </div>

                      <div>
                        <span className="text-[11px] text-stone-400 block">Total Stock</span>
                        <span
                          className={`font-mono font-bold text-xs tabular-nums ${
                            totalStock <= 5 ? 'text-amber-600' : 'text-stone-900'
                          }`}
                        >
                          {totalStock} units
                        </span>
                      </div>

                      {/* Edit / Delete actions */}
                      {hasPermission('products.manage') && (
                        <div className="flex items-center gap-1 pl-2 border-l border-stone-200">
                          <button
                            onClick={() => handleOpenEdit(prod)}
                            className="p-1.5 text-stone-400 hover:text-stone-800 rounded transition-colors cursor-pointer"
                            title="Edit garment properties"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {hasPermission('products.manage') && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Delete "${prod.name}" and all ${prod.variants.length} variants permanently?`)) {
                                  deleteProduct(prod.id);
                                }
                              }}
                              className="p-1.5 text-stone-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                              title="Delete garment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded Variant Matrix Sub-Table */}
                  {isExpanded && (
                    <div className="px-6 pb-4 pt-1 bg-stone-50 border-t border-stone-100">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs font-mono">
                          <thead>
                            <tr className="text-stone-500 border-b border-stone-200 text-[11px]">
                              <th className="py-2 font-medium">SKU</th>
                              <th className="py-2 font-medium">Barcode</th>
                              <th className="py-2 font-medium">Color</th>
                              <th className="py-2 font-medium">Size</th>
                              <th className="py-2 font-medium text-right">Cost Price</th>
                              <th className="py-2 font-medium text-right">Selling Price {settings.registrationType === 'regular' ? (settings.priceMode === 'inclusive' ? '(GST incl.)' : '(before GST)') : ''}</th>
                              <th className="py-2 font-medium text-right">Margin %</th>
                              <th className="py-2 font-medium text-right">Stock Level</th>
                              <th className="py-2 font-medium text-right">Floor Location</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-200/60">
                            {prod.variants.map((v) => {
                              const effectiveSellingPrice = settings.registrationType === 'regular' && settings.priceMode === 'inclusive'
                                ? v.sellingPrice / (1 + getGstRate(prod.hsnCode, v.sellingPrice, prod.taxRate ?? settings.taxRateDefault) / 100)
                                : v.sellingPrice;
                              const margin =
                                effectiveSellingPrice > 0
                                  ? (((effectiveSellingPrice - v.costPrice) / effectiveSellingPrice) * 100).toFixed(1)
                                  : '0.0';

                              return (
                                <tr key={v.id} className="hover:bg-white/80">
                                  <td className="py-2 font-semibold text-stone-900">{v.sku}</td>
                                  <td className="py-2 text-stone-600 flex items-center gap-1.5">
                                    <Barcode className="w-3 h-3 text-stone-400 shrink-0" />
                                    <span>{v.barcode}</span>
                                  </td>
                                  <td className="py-2 font-sans font-medium text-stone-800">
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className="w-2.5 h-2.5 rounded-full border border-stone-300 shrink-0"
                                        style={{ backgroundColor: garmentColorHex(v.color, v.colorHex, '#bbb') }}
                                      />
                                      <span>{v.color}</span>
                                    </div>
                                  </td>
                                  <td className="py-2 font-bold text-stone-900">{v.size}</td>
                                  <td className="py-2 text-right tabular-nums text-stone-600">
                                    {settings.currencySymbol}{v.costPrice.toFixed(2)}
                                  </td>
                                  <td className="py-2 text-right tabular-nums font-bold text-stone-900">
                                    {settings.currencySymbol}{v.sellingPrice.toFixed(2)}
                                  </td>
                                  <td className="py-2 text-right tabular-nums text-emerald-700">
                                    {margin}%
                                  </td>
                                  <td className="py-2 text-right tabular-nums font-bold">
                                    <span
                                      className={
                                        v.stock <= 0
                                          ? 'text-rose-600'
                                          : v.stock <= v.minStockThreshold
                                          ? 'text-amber-600'
                                          : 'text-stone-900'
                                      }
                                    >
                                      {v.stock}
                                    </span>
                                  </td>
                                  <td className="py-2 text-right font-sans text-stone-500">
                                    {v.location || 'Rack'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Garment Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full text-stone-900 border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 bg-stone-900 text-stone-100 flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingProductId ? 'Edit Garment Details' : 'Add New Garment Style & Variants'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-stone-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Product Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Garment Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Linen Camp Collar Short-Sleeve Shirt"
                    className="w-full px-3 py-1.5 border border-stone-300 rounded focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">Brand</label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g. Atelier Threads"
                    className="w-full px-3 py-1.5 border border-stone-300 rounded focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as GarmentProduct['category'])}
                    className="w-full px-3 py-1.5 border border-stone-300 rounded focus:outline-hidden"
                  >
                    {categories.filter((c) => c !== 'all').map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">Style Code *</label>
                  <input
                    type="text"
                    required
                    value={styleCode}
                    onChange={(e) => setStyleCode(e.target.value.toUpperCase())}
                    placeholder="e.g. SH-LNN-20"
                    className="w-full px-3 py-1.5 border border-stone-300 rounded focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as GarmentProduct['gender'])}
                    className="w-full px-3 py-1.5 border border-stone-300 rounded focus:outline-hidden"
                  >
                    <option value="Men">Men</option>
                    <option value="Women">Women</option>
                    <option value="Unisex">Unisex</option>
                    <option value="Kids">Kids</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">Material / Fabric</label>
                  <input
                    type="text"
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                    placeholder="e.g. 100% French Linen"
                    className="w-full px-3 py-1.5 border border-stone-300 rounded focus:outline-hidden"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-medium text-stone-700 mb-1">
                    HSN Code {settings.registrationType === 'unregistered' ? '(optional)' : '*'}
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={['6205', '6203', '6204', '6109', '6110', '6105', '6206', '6211', '4203', '6217'].includes(hsnCode) ? hsnCode : 'custom'}
                      onChange={(e) => {
                        if (e.target.value !== 'custom') {
                          setHsnCode(e.target.value);
                        }
                      }}
                      className="flex-1 px-3 py-1.5 border border-stone-300 rounded focus:outline-hidden font-mono bg-white"
                    >
                      <option value="6205">6205 — Men's or Boys' Shirts (Woven)</option>
                      <option value="6203">6203 — Men's Suits, Blazers, Jackets & Trousers (Woven)</option>
                      <option value="6204">6204 — Women's Dresses, Suits, Jackets & Skirts (Woven)</option>
                      <option value="6109">6109 — T-Shirts, Singlets & Vests (Knitted / Crocheted)</option>
                      <option value="6110">6110 — Jerseys, Pullovers, Cardigans & Sweaters (Knitted)</option>
                      <option value="6105">6105 — Men's or Boys' Polo Shirts (Knitted)</option>
                      <option value="6206">6206 — Women's or Girls' Blouses & Shirts</option>
                      <option value="6211">6211 — Track Suits, Ethnic Wear, Kurta & Sherwani</option>
                      <option value="4203">4203 — Articles of Apparel & Accessories of Leather (Belts)</option>
                      <option value="6217">6217 — Clothing Accessories (Ties, Bows, Pocket Squares)</option>
                      <option value="custom">Custom HSN Code (Enter on right)...</option>
                    </select>
                    <input
                      type="text"
                      value={hsnCode}
                      onChange={(e) => setHsnCode(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="HSN Code"
                      maxLength={8}
                      className="w-full sm:w-32 px-3 py-1.5 border border-stone-300 rounded focus:outline-hidden font-mono font-bold text-stone-900 bg-white"
                    />
                  </div>
                  <span className="text-[10px] text-stone-500 mt-1 block">
                  {settings.registrationType === 'unregistered' ? 'HSN is optional for this retail receipt mode.' : 'Enter the product’s verified HSN for registered GST invoices and bills of supply.'}
                  </span>
                </div>
              {settings.registrationType === 'regular' && <div>
                  <label className="block font-medium text-stone-700 mb-1">Configured GST rate for other goods (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-stone-300 rounded font-mono"
                  />
                  <span className="text-[10px] text-stone-500 mt-1 block">For non-apparel HSNs only. Verify classification and rate before sale.</span>
                </div>}
              </div>

              {/* Variant Matrix Generator (Only when adding brand new product) */}
              {!editingProductId && (
                <div className="p-4 bg-stone-50 border border-stone-200 rounded space-y-3">
                  <div className="flex items-center gap-1.5 font-bold text-stone-900">
                    <Layers className="w-4 h-4 text-amber-500" />
                    <span>Variant Matrix Generator</span>
                  </div>

                  <div>
                    <label className="block font-medium text-stone-700 mb-1">
                      Available Sizes (Select all to create)
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {standardSizes.map((sz) => {
                        const isChecked = selectedSizes.includes(sz);
                        return (
                          <button
                            type="button"
                            key={sz}
                            onClick={() => {
                              setSelectedSizes((prev) =>
                                isChecked ? prev.filter((s) => s !== sz) : [...prev, sz]
                              );
                            }}
                            className={`px-2.5 py-1 text-xs font-mono font-semibold rounded border cursor-pointer ${
                              isChecked
                                ? 'bg-stone-900 text-white border-stone-900'
                                : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                            }`}
                          >
                            {sz}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-stone-700 mb-1">
                      Colors (select all that apply)
                    </label>
                    <div className="max-h-36 overflow-y-auto rounded border border-stone-200 bg-white p-2">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {STANDARD_GARMENT_COLORS.map((color) => {
                          const checked = selectedColors.includes(color);
                          return (
                            <label key={color} className={`flex items-center gap-2 rounded px-2 py-1 text-xs cursor-pointer ${checked ? 'bg-amber-50 text-stone-900' : 'text-stone-600 hover:bg-stone-50'}`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) => setSelectedColors((current) => event.target.checked
                                  ? [...current, color]
                                  : current.filter((value) => value !== color))}
                                className="accent-amber-500"
                              />
                              <span className="w-3.5 h-3.5 rounded-full border border-stone-300" style={{ backgroundColor: garmentColorHex(color) }} />
                              <span>{color}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={customColorInput}
                        onChange={(event) => setCustomColorInput(event.target.value)}
                        placeholder="Custom color name"
                        className="min-w-0 flex-1 px-3 py-1.5 border border-stone-300 rounded focus:outline-hidden bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const value = customColorInput.trim().replace(/\s+/g, ' ');
                          if (!value) return;
                          if ([...selectedColors, ...customColors].some((color) => color.toLowerCase() === value.toLowerCase())) {
                            alert('That color is already selected.');
                            return;
                          }
                          setCustomColors((current) => [...current, value]);
                          setCustomColorInput('');
                        }}
                        className="px-3 py-1.5 text-xs font-semibold border border-stone-300 rounded hover:bg-stone-50"
                      >Add</button>
                    </div>
                    {customColors.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {customColors.map((color) => (
                          <button key={color} type="button" onClick={() => setCustomColors((current) => current.filter((value) => value !== color))} className="inline-flex items-center gap-1 rounded-full border border-stone-300 px-2 py-1 text-[11px] hover:bg-rose-50" title={`Remove ${color}`}>
                            <span className="w-3 h-3 rounded-full border border-stone-300" style={{ backgroundColor: garmentColorHex(color) }} />{color}<X className="w-3 h-3" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block font-medium text-stone-700 mb-1">
                        Base Cost ({settings.currencySymbol})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={baseCost}
                        onChange={(e) => setBaseCost(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 border border-stone-300 rounded font-mono bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-stone-700 mb-1">
                        Retail Price ({settings.currencySymbol}) {settings.registrationType === 'regular' ? (settings.priceMode === 'inclusive' ? 'including GST' : 'before GST') : ''}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={basePrice}
                        onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 border border-stone-300 rounded font-mono bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-stone-700 mb-1">
                        Initial Stock / Variant
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={initialStockPerVariant}
                        onChange={(e) => setInitialStockPerVariant(parseInt(e.target.value, 10) || 0)}
                        className="w-full px-3 py-1.5 border border-stone-300 rounded font-mono bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-medium text-stone-700 mb-1">Care Notes & Fitting Details</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Dry clean recommended. True to size tailoring."
                  className="w-full px-3 py-1.5 border border-stone-300 rounded focus:outline-hidden"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded cursor-pointer"
                >
                  {editingProductId ? 'Save Changes' : 'Generate & Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
