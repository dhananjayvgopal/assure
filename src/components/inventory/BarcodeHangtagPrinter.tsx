/**
 * Garment Price Tag & Barcode Hangtag Printing Tool
 * Formats scannable Code 128 barcodes, style codes, colors, sizes, and prices
 * for thermal sticker rolls (50x30mm / 38x25mm) and apparel hangtags.
 */

import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { GarmentVariant, GarmentProduct } from '../../types/pos';
import { generateBarcodeSvg } from '../../utils/barcode128';
import { printDocument } from '../../utils/printing';
import { Printer, Tag, X, CheckSquare, Square } from 'lucide-react';

interface BarcodeHangtagPrinterProps {
  isOpen: boolean;
  onClose: () => void;
  presetVariant?: GarmentVariant;
}

export const BarcodeHangtagPrinter: React.FC<BarcodeHangtagPrinterProps> = ({
  isOpen,
  onClose,
  presetVariant,
}) => {
  const { products, settings } = usePOS();

  // Print quantities map: variantId -> count
  const [printQuantities, setPrintQuantities] = useState<Record<string, number>>(() => {
    if (presetVariant) {
      return { [presetVariant.id]: 4 };
    }
    // Default 2 tags for first product's variants
    const initial: Record<string, number> = {};
    if (products.length > 0) {
      products[0].variants.forEach((v) => {
        initial[v.id] = 2;
      });
    }
    return initial;
  });

  const [selectedProductId, setSelectedProductId] = useState<string>(
    presetVariant ? presetVariant.productId : products[0]?.id || ''
  );

  const [labelFormat, setLabelFormat] = useState<'50x30mm' | 'hangtag'>('50x30mm');
  // Use portrait A4 for the common office-printer path. Staff can switch to
  // the continuous 100 mm 2-up label roll when printing on their tag printer.
  const [printLayout, setPrintLayout] = useState<'roll-100mm-2up' | 'a4'>('a4');

  if (!isOpen) return null;

  const currentProduct = products.find((p) => p.id === selectedProductId) || products[0];

  const handlePrint = () => {
    void printDocument('printable-hangtags');
  };

  const handleQuantityChange = (variantId: string, count: number) => {
    setPrintQuantities((prev) => ({
      ...prev,
      [variantId]: Math.max(0, count),
    }));
  };

  // Compile flat list of tags to render
  const tagsToPrint: {
    product: GarmentProduct;
    variant: GarmentVariant;
  }[] = [];

  if (currentProduct) {
    currentProduct.variants.forEach((v) => {
      const qty = printQuantities[v.id] || 0;
      for (let i = 0; i < qty; i++) {
        tagsToPrint.push({ product: currentProduct, variant: v });
      }
    });
  }

  return (
    <div id="hangtag-print-modal" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full text-stone-900 border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header (Hidden on print) */}
        <div className="px-6 py-4 bg-stone-900 text-stone-100 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm">Print Barcode Price Tags & Hangtags</h3>
              <span className="text-[11px] text-stone-400">
                Format scannable Code 128 barcodes for thermal sticker rolls or cardstock tags.
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-white p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration Bar (Hidden on print) */}
        <div className="p-4 bg-stone-50 border-b border-stone-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 print:hidden text-xs">
          <div>
            <label className="block font-medium text-stone-700 mb-1">Select Garment</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded font-medium"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.styleCode})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-stone-700 mb-1">Tag Format</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLabelFormat('50x30mm')}
                className={`flex-1 py-1.5 px-2 rounded border font-semibold cursor-pointer ${
                  labelFormat === '50x30mm'
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-white text-stone-700 border-stone-300'
                }`}
              >
                50x30mm Sticker
              </button>
              <button
                type="button"
                onClick={() => setLabelFormat('hangtag')}
                className={`flex-1 py-1.5 px-2 rounded border font-semibold cursor-pointer ${
                  labelFormat === 'hangtag'
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-white text-stone-700 border-stone-300'
                }`}
              >
                Apparel Hangtag
              </button>
            </div>
          </div>

          <div>
            <label className="block font-medium text-stone-700 mb-1">Print Layout</label>
            <select
              value={printLayout}
              onChange={(e) => setPrintLayout(e.target.value as 'roll-100mm-2up' | 'a4')}
              className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded font-medium"
            >
              <option value="roll-100mm-2up">100 mm label roll · {labelFormat === '50x30mm' ? '2-up' : 'single-up'}</option>
              <option value="a4">A4 sheet · auto-fit labels</option>
            </select>
            <p className="mt-1 text-[10px] leading-snug text-stone-500">A4 portrait prints stickers 2-up and hangtags in 3 columns. Choose the 100 mm roll for 2-up stickers or 1-up hangtags. Chrome kiosk mode uses the Windows default printer.</p>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handlePrint}
              disabled={tagsToPrint.length === 0}
              className="w-full py-1.5 px-4 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 rounded flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print {tagsToPrint.length} Tag{tagsToPrint.length === 1 ? '' : 's'}</span>
            </button>
          </div>
        </div>

        {/* Quantities Table per Variant (Hidden on print) */}
        {currentProduct && (
          <div className="p-4 bg-white border-b border-stone-200 print:hidden text-xs">
            <span className="font-semibold text-stone-800 block mb-2">
              Set Tag Quantities for: {currentProduct.name}
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {currentProduct.variants.map((v) => (
                <div key={v.id} className="p-2 border border-stone-200 rounded bg-stone-50/50">
                  <div className="text-[11px] font-semibold text-stone-900 truncate">{v.color}</div>
                  <div className="text-[10px] text-stone-500 font-mono">Size {v.size}</div>
                  <div className="mt-1 flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={printQuantities[v.id] || 0}
                      onChange={(e) => handleQuantityChange(v.id, parseInt(e.target.value, 10) || 0)}
                      className="w-14 px-1.5 py-0.5 text-xs font-mono font-bold bg-white border border-stone-300 rounded text-center"
                    />
                    <span className="text-[10px] text-stone-400">tags</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PRINTABLE PREVIEW CANVAS (This area prints cleanly) */}
        <div className="flex-1 overflow-y-auto p-6 bg-stone-100 flex justify-center">
          <div
            id="printable-hangtags"
            data-label-format={labelFormat}
            data-print-layout={printLayout}
            className="flex flex-wrap gap-4 justify-start max-w-3xl bg-white p-6 rounded shadow-xs"
          >
            {tagsToPrint.length === 0 ? (
              <div className="w-full text-center py-12 text-stone-400 text-xs">
                No tags selected. Increase quantity above to generate tag sheets.
              </div>
            ) : (
              tagsToPrint.map((tag, idx) => {
                const barcodeSvg = generateBarcodeSvg(tag.variant.barcode, {
                  height: labelFormat === '50x30mm' ? 22 : 32,
                  moduleWidth: 1,
                  showText: true,
                  fontSize: labelFormat === '50x30mm' ? 7 : 9,
                });
                const shortTagPriceLabel = settings.registrationType === 'regular' && settings.priceMode === 'exclusive'
                  ? 'Price ex-GST'
                  : 'MRP';

                return (
                  <div
                    key={idx}
                    className={`border border-dashed border-stone-400 bg-white p-3 flex flex-col justify-between text-stone-950 font-sans ${
                      labelFormat === '50x30mm'
                        ? 'w-[190px] h-[130px] rounded'
                        : 'w-[210px] h-[280px] rounded-lg shadow-xs'
                    }`}
                  >
                    {/* Tag Top Header */}
                    <div className="text-center border-b border-stone-200 pb-1">
                      <span className="font-bold text-[10px] tracking-wider uppercase block truncate">
                        {settings.storeName}
                      </span>
                      <span className="text-[9px] text-stone-500 block truncate">
                        {tag.product.brand} · {tag.product.styleCode}{settings.registrationType !== 'unregistered' ? ` · HSN: ${tag.product.hsnCode || '6205'}` : ''}
                      </span>
                    </div>

                    {/* Garment Details & Variant */}
                    <div className="my-1 space-y-0.5 text-center">
                      <h5 className="font-bold text-[11px] text-stone-900 leading-tight line-clamp-1">
                        {tag.product.name}
                      </h5>
                      <div className="flex justify-center items-center gap-1.5 text-[10px] text-stone-700 font-mono">
                        <span className="font-bold bg-stone-100 px-1 py-0.2 rounded">
                          SIZE: {tag.variant.size}
                        </span>
                        <span>·</span>
                        <span>{tag.variant.color}</span>
                      </div>
                    </div>

                    {/* Scannable Barcode SVG */}
                    <div className="my-1 flex justify-center">
                      <div
                        className="w-full max-w-[170px]"
                        dangerouslySetInnerHTML={{ __html: barcodeSvg }}
                      />
                    </div>

                    {/* Price Tag Footer with Indian MRP and HSN */}
                    <div className="text-center border-t border-stone-300 pt-1">
                      <div className="flex justify-between items-baseline px-1">
                        {settings.registrationType !== 'unregistered' && <span className="text-[9px] font-mono text-stone-600 font-bold">
                          HSN {tag.product.hsnCode || '6205'}
                        </span>}
                        <span className="text-[12px] font-mono font-bold text-stone-950 tabular-nums">
                          {labelFormat === '50x30mm' ? shortTagPriceLabel : settings.registrationType === 'regular' && settings.priceMode === 'exclusive' ? 'Retail price (before GST)' : 'MRP'}: {settings.currencySymbol}{tag.variant.sellingPrice.toFixed(2)}{labelFormat !== '50x30mm' && settings.registrationType === 'regular' && settings.priceMode === 'inclusive' ? ' (GST included)' : ''}
                        </span>
                      </div>
                      <span className="text-[8px] text-stone-400 block -mt-0.5">
                        (Incl. of all taxes)
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
