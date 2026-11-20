import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileDown,
  Smartphone,
  WifiOff,
  X,
} from 'lucide-react';

interface OfflineModalProps {
  open: boolean;
  onClose: () => void;
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  swReady: boolean;
  onInstallPWA: () => Promise<boolean>;
  onDownloadHtml: () => Promise<void>;
}

export const OfflineModal: React.FC<OfflineModalProps> = ({
  open,
  onClose,
  isInstallable,
  isInstalled,
  isIOS,
  swReady,
  onInstallPWA,
  onDownloadHtml,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!open) return null;

  const handleDownloadFile = async () => {
    setDownloading(true);
    setStatusMsg(null);
    try {
      await onDownloadHtml();
      setStatusMsg('تم تنزيل ملف Mahmoud_Chess_Offline.html — يمكنك فتحه في أي وقت بدون إنترنت.');
    } catch {
      setStatusMsg('تعذر التنزيل حالياً، تأكد من الاتصال ثم حاول مجدداً.');
    } finally {
      setDownloading(false);
    }
  };

  const handleInstallApp = async () => {
    const ok = await onInstallPWA();
    if (ok) {
      setStatusMsg('تم تثبيت التطبيق بنجاح على جهازك!');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-white/12 bg-[#161e2b] p-6 text-right shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold text-white">
              تحميل وتشغيل اللعبة بدون إنترنت
            </h2>
            <p className="mt-1 text-xs text-[#9aa8bd]">
              احفظ محمود شطرنج على جهازك للعب ضد الكمبيوتر أو لاعبين اثنين بدون نت
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-lg p-1.5 text-[#9aa8bd] transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {/* Option 1: Install as PWA */}
          <div className="rounded-lg border border-white/10 bg-[#1c2636] p-4">
            <div className="flex items-center gap-2.5 text-sm font-bold text-white">
              <Smartphone className="h-4 w-4 text-[#2bb673]" />
              <span>1. تثبيت الموقع كتطبيق (PWA)</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-[#9aa8bd]">
              يثبّت الموقع على شاشتك الرئيسية ويعمل بالكامل بدون اتصال بالإنترنت عبر التخزين المحلي الذكي.
            </p>

            {isInstalled ? (
              <div className="mt-3 flex items-center gap-2 text-xs font-bold text-[#2bb673]">
                <CheckCircle2 className="h-4 w-4" />
                <span>التطبيق مثبّت ويعمل حالياً بوضع التطبيق المستقل</span>
              </div>
            ) : isInstallable ? (
              <button
                type="button"
                onClick={handleInstallApp}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#2bb673] px-4 py-2.5 text-sm font-bold text-[#072115] transition hover:bg-[#32c87f]"
              >
                <Download className="h-4 w-4" />
                تثبيت التطبيق الآن
              </button>
            ) : isIOS ? (
              <div className="mt-3 rounded-lg bg-[#111722] p-3 text-xs leading-relaxed text-[#dce5f2]">
                على أجهزة iPhone و iPad:
                <br />
                1. اضغط على زر <strong>مشاركة (Share)</strong> في متصفح Safari.
                <br />
                2. اختر <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong>.
              </div>
            ) : (
              <div className="mt-3 rounded-lg bg-[#111722] p-3 text-xs leading-relaxed text-[#9aa8bd]">
                {swReady ? (
                  <span className="flex items-center gap-1.5 text-[#2bb673] font-semibold">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    تم حفظ ملفات الموقع مؤقتاً — يمكنك أيضاً التثبيت من قائمة المتصفح (أيقونة التثبيت في شريط العنوان).
                  </span>
                ) : (
                  'يمكنك التثبيت من قائمة المتصفح (تثبيت التطبيق / إضافة إلى الشاشة الرئيسية).'
                )}
              </div>
            )}
          </div>

          {/* Option 2: Download Single-File HTML */}
          <div className="rounded-lg border border-white/10 bg-[#1c2636] p-4">
            <div className="flex items-center gap-2.5 text-sm font-bold text-white">
              <FileDown className="h-4 w-4 text-[#d4a84b]" />
              <span>2. تنزيل صفحة مستقلة ملف واحد (HTML)</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-[#9aa8bd]">
              نزّل نسخة كاملة في ملف واحد على جهازك أو هاتفك لتفتحه في أي متصفح بدون إنترنت تماماً.
            </p>
            <button
              type="button"
              onClick={handleDownloadFile}
              disabled={downloading}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#d4a84b]/40 bg-[#d4a84b]/15 px-4 py-2.5 text-sm font-bold text-[#f2d28b] transition hover:bg-[#d4a84b]/25 disabled:opacity-50"
            >
              <FileDown className="h-4 w-4" />
              {downloading
                ? 'جاري تجهيز الملف...'
                : 'تحميل الصفحة للعمل بدون نت (HTML)'}
            </button>
          </div>

          {swReady && (
            <div className="flex items-center justify-center gap-2 text-xs text-[#9aa8bd]">
              <WifiOff className="h-3.5 w-3.5 text-[#2bb673]" />
              <span>وضع عدم الاتصال مفعّل وجاهز للعب ضد الكمبيوتر أو لاعبين</span>
            </div>
          )}

          {statusMsg && (
            <div className="rounded-lg border border-[#2bb673]/30 bg-[#2bb673]/10 px-3 py-2 text-xs font-semibold text-[#5ee3a3]">
              {statusMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
