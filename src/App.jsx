import React, { useState, useRef, useEffect } from 'react';
import { Upload, Check, Loader2, ArrowRight, RefreshCcw, Download, Wand2, Camera, Sun, Armchair, ImageIcon, Building, AlertCircle, Eraser, Move, Layers, XCircle, Info, Sparkles, Smartphone, Box, Zap } from 'lucide-react';

const AIProductStudio = () => {
  // --- KONFIGURACJA KLUCZA API ---
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    try {
      if (typeof import.meta !== 'undefined' && import.meta.env) {
        const envKey = import.meta.env.VITE_GOOGLE_API_KEY;
        if (envKey) setApiKey(envKey);
      }
    } catch (e) {
      console.warn('Brak dostępu do zmiennych środowiskowych');
    }
  }, []);

  const [step, setStep] = useState(1);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [selectedStyleIndex, setSelectedStyleIndex] = useState(null);
  
  // Tryby i Statusy
  const [isPackshotMode, setIsPackshotMode] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [usedModel, setUsedModel] = useState(''); // Informacja jaki model został użyty
  
  // Wynik końcowy
  const [finalCompositeImage, setFinalCompositeImage] = useState(null);
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);

  // Style generujące tła
  const styles = [
    {
      id: 'scandi',
      title: 'Produkt na stole',
      icon: <Armchair className="w-6 h-6" />,
      description: 'Jasne drewno, scandi, poranne światło.',
      prompt: "Top down view of a light oak wooden table surface, blurred modern bright living room background, scandi style interior, soft natural morning light coming from a window on the side, photorealistic, 8k resolution, depth of field, empty center area, no objects in center."
    },
    {
      id: 'kids_indoor',
      title: 'Zabawki w pokoju',
      icon: <ImageIcon className="w-6 h-6" />,
      description: 'Puszysty dywan, pastelowe kolory.',
      prompt: "Top down view of a soft fluffy beige carpet surface, cozy nursery room background, blurred colorful toys and blocks in the background, pastel color palette, warm ambient lighting, highly detailed, realistic texture, empty center area, no objects in center."
    },
    {
      id: 'kids_outdoor',
      title: 'Zabawki na dworze',
      icon: <Sun className="w-6 h-6" />,
      description: 'Zielona trawa, słońce, lato.',
      prompt: "Top down view of manicured green grass, sunny backyard garden background, summer atmosphere, vibrant colors, bright sunlight, lens flare, bokeh effect, cinematic lighting, 8k, empty center area, no objects in center."
    },
    {
      id: 'outdoor_commercial',
      title: 'Produkt Outdoor',
      icon: <Building className="w-6 h-6" />,
      description: 'Betonowe patio, złota godzina.',
      prompt: "Top down view of a modern grey concrete patio surface, blurred outdoor nature background with potted plants, golden hour lighting, dramatic shadows, architectural elements, high contrast, crisp details, photorealistic, empty center area, no objects in center."
    }
  ];

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result);
        setError('');
        setIsPackshotMode(false);
      };
      reader.readAsDataURL(file);
    }
  };

  // --- HELPER: GENEROWANIE OBRAZU Z PRIORYTETEM GOOGLE ---
  const generateImageWithGooglePriority = async (prompt) => {
    let imageUrl = null;
    let modelName = 'Flux (Darmowy)';

    if (apiKey) {
        // 1. Próba: Imagen 3 (Najwyższa jakość)
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instances: [{ prompt }],
                    parameters: { sampleCount: 1, aspectRatio: "1:1" }
                })
            });
            if (response.ok) {
                const data = await response.json();
                if (data.predictions?.[0]?.bytesBase64Encoded) {
                    imageUrl = `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`;
                    modelName = 'Google Imagen 3 (Pro)';
                }
            }
        } catch (e) { console.log('Imagen 3 nie powiódł się, próbuję starszy...'); }

        // 2. Próba: Imagen 2 (Wysoka kompatybilność) - tylko jeśli Imagen 3 zawiódł
        if (!imageUrl) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-2.0-generate-001:predict?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        instances: [{ prompt }],
                        parameters: { sampleCount: 1, aspectRatio: "1:1" }
                    })
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.predictions?.[0]?.bytesBase64Encoded) {
                        imageUrl = `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`;
                        modelName = 'Google Imagen 2';
                    }
                }
            } catch (e) { console.log('Imagen 2 nie powiódł się.'); }
        }
    }

    // 3. Fallback: Pollinations (Gdy Google zawiedzie)
    if (!imageUrl) {
        const seed = Math.floor(Math.random() * 1000000);
        const encodedPrompt = encodeURIComponent(prompt);
        imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&width=1080&height=1080&nologo=true&model=flux&enhance=false`;
    }

    return { imageUrl, modelName };
  };


  // --- FUNKCJA: PRZERÓB NA PACKSHOT ---
  const handleConvertToPackshot = async () => {
    if (!uploadedImage || !apiKey) {
      setError("Potrzebny jest klucz API Google do analizy zdjęcia.");
      return;
    }

    setIsProcessing(true);
    setProcessingStatus('Analizuję produkt (Gemini Vision)...');
    
    try {
      // 1. Analiza obrazu
      const base64Data = uploadedImage.split(',')[1];
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "Describe this object in detail (color, shape, material) for a product photography prompt. Keep it concise, e.g. 'A black ceramic coffee mug'." },
              { inlineData: { mimeType: "image/jpeg", data: base64Data } }
            ]
          }]
        })
      });

      const data = await response.json();
      const description = data.candidates?.[0]?.content?.parts?.[0]?.text || "product";

      // 2. Generowanie packshotu
      setProcessingStatus('Generuję packshot wysokiej jakości...');
      const prompt = `Professional product photography of ${description}, isolated on pure white background, studio lighting, 8k, sharp focus, centered, full shot.`;
      
      const { imageUrl, modelName } = await generateImageWithGooglePriority(prompt);
      
      // Preload
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });

      setUploadedImage(imageUrl);
      setIsPackshotMode(true);
      setUsedModel(modelName);
      setProcessingStatus('');

    } catch (err) {
      console.error(err);
      setError("Nie udało się przerobić zdjęcia. Sprawdź klucz API.");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- FUNKCJA GŁÓWNA: GENERUJ I SCAL ---
  const handleGenerate = async () => {
    if (!uploadedImage || selectedStyleIndex === null) return;

    setIsProcessing(true);
    setProcessingStatus('Generuję fotorealistyczne tło...');
    setError('');
    setFinalCompositeImage(null);

    const selectedStylePrompt = styles[selectedStyleIndex].prompt;
    
    try {
        // 1. Generujemy TŁO
        const { imageUrl: bgImageUrl, modelName } = await generateImageWithGooglePriority(selectedStylePrompt);
        setUsedModel(modelName);
        
        // Czekamy na załadowanie tła
        const bgImg = await new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = bgImageUrl;
        });
        
        setProcessingStatus('Składanie kompozycji...');

        // 2. AUTOMATYCZNE SCALANIE
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');

        // Rysuj tło
        ctx.drawImage(bgImg, 0, 0, 1080, 1080);

        // Ładujemy produkt
        const prodImg = await new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = uploadedImage;
        });

        const targetScale = 0.70;
        const w = 1080 * targetScale; 
        const ratio = prodImg.width / prodImg.height;
        const drawH = w / ratio; 
        
        const x = (1080 - w) / 2;
        const y = (1080 - drawH) / 2 + 50;

        // Tryb mieszania dla packshotów
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(prodImg, x, y, w, drawH);
        ctx.globalCompositeOperation = 'source-over';

        const finalUrl = canvas.toDataURL('image/jpeg', 0.95);
        setFinalCompositeImage(finalUrl);
        setStep(3);
        
    } catch (err) {
        console.error(err);
        setError('Wystąpił błąd podczas generowania. Spróbuj ponownie.');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const resetProcess = () => {
    setStep(1);
    setFinalCompositeImage(null);
    setUploadedImage(null);
    setSelectedStyleIndex(null);
    setIsPackshotMode(false);
    setUsedModel('');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-100">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-2 rounded-lg">
              <Camera size={20} />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600">
              AI Product Studio
            </h1>
          </div>
          <div className="flex items-center gap-4">
             {apiKey && (
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-full border border-green-200 font-medium">
                    <Check size={12} /> API Płatne (Pro)
                </div>
             )}
             <div className="text-sm text-slate-500 font-medium border-l pl-4 ml-2">
               Krok {step} z 3
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        
        {/* Krok 1: Upload */}
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-slate-900 mb-2">Wgraj produkt</h2>
              <p className="text-slate-500">Wgraj zdjęcie. System obsługuje packshoty oraz zdjęcia z telefonu.</p>
            </div>

            <div 
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 ${uploadedImage ? 'border-blue-500 bg-blue-50/50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => setUploadedImage(reader.result);
                    reader.readAsDataURL(file);
                }
              }}
            >
              {!uploadedImage ? (
                <div className="flex flex-col items-center gap-4 py-12">
                  <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-2">
                    <Upload size={32} />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-slate-700">Przeciągnij zdjęcie tutaj</p>
                    <p className="text-sm text-slate-400 mt-1">lub kliknij, aby wybrać plik</p>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileUpload} 
                    accept="image/*" 
                    className="hidden" 
                  />
                  <button 
                    onClick={() => fileInputRef.current.click()}
                    className="px-6 py-2 bg-white border border-slate-300 rounded-full text-slate-700 font-medium hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    Wybierz plik
                  </button>
                </div>
              ) : (
                <div className="relative group">
                  <img src={uploadedImage} alt="Uploaded" className="max-h-96 mx-auto rounded-lg shadow-lg object-contain bg-white" />
                  
                  {isProcessing && (
                     <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center z-10">
                        <Loader2 className="animate-spin text-blue-600 mb-2" size={32} />
                        <span className="text-sm font-medium text-blue-800">{processingStatus}</span>
                     </div>
                  )}

                  <div className="absolute top-2 right-2">
                    <button 
                      onClick={() => setUploadedImage(null)}
                      className="bg-white/90 text-red-600 p-2 rounded-full hover:bg-white shadow-sm"
                      title="Usuń"
                    >
                      <XCircle size={20} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {uploadedImage && !isProcessing && (
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    {!isPackshotMode ? (
                        <button 
                            onClick={handleConvertToPackshot}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium border border-indigo-100"
                        >
                            <Sparkles size={16} /> Wyczyść tło (AI Packshot)
                        </button>
                    ) : (
                        <div className="flex items-center gap-2 text-green-600 text-sm font-medium px-4 py-2 bg-green-50 rounded-lg">
                            <CheckCircle2 size={16} /> Tło wyczyszczone
                        </div>
                    )}
                </div>

                <button 
                  onClick={() => setStep(2)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-semibold transition-all shadow-md hover:shadow-lg transform active:scale-95"
                >
                  Dalej <ArrowRight size={18} />
                </button>
              </div>
            )}
            
            {error && (
                <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm text-center border border-red-100">
                    {error}
                </div>
            )}
          </div>
        )}

        {/* Krok 2: Wybór Stylu */}
        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="flex items-center gap-2 mb-6 cursor-pointer text-slate-500 hover:text-blue-600 transition-colors" onClick={() => setStep(1)}>
               <ArrowRight className="rotate-180" size={16} /> Wróć do zdjęcia
            </div>
            
            <h2 className="text-3xl font-bold text-slate-900 mb-2 text-center">Gdzie robimy sesję?</h2>
            <p className="text-slate-500 text-center mb-8">Wybierz scenerię. Wykorzystamy najlepsze modele AI.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {styles.map((style, index) => (
                <div 
                  key={style.id}
                  onClick={() => setSelectedStyleIndex(index)}
                  className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${selectedStyleIndex === index ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600 ring-offset-2' : 'border-slate-200 bg-white hover:border-blue-300'}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${selectedStyleIndex === index ? 'bg-blue-200 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                      {style.icon}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{style.title}</h3>
                      <p className="text-sm text-slate-500 mt-1 leading-relaxed">{style.description}</p>
                    </div>
                  </div>
                  {selectedStyleIndex === index && (
                    <div className="absolute top-4 right-4 text-blue-600">
                      <Check size={20} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button 
              onClick={handleGenerate}
              disabled={selectedStyleIndex === null || isProcessing}
              className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg ${
                selectedStyleIndex !== null && !isProcessing
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:scale-[1.02] active:scale-[0.98]' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" /> {processingStatus}
                </>
              ) : (
                <>
                  <Wand2 size={20} /> Generuj sesję (Pro)
                </>
              )}
            </button>
            
            {error && (
              <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-lg text-sm text-center">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Krok 3: Wynik */}
        {step === 3 && finalCompositeImage && (
          <div className="animate-in fade-in zoom-in duration-500">
            <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">Twoje Studio</h2>
            
            <div className="flex justify-center items-center gap-2 mb-6">
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full flex items-center gap-1">
                   <Zap size={12} className={usedModel.includes('Google') ? 'text-green-500' : 'text-amber-500'} fill="currentColor"/> 
                   Wygenerowano przez: {usedModel}
                </span>
            </div>

            <div className="bg-white p-2 rounded-2xl shadow-xl border border-slate-200 mb-8 max-w-lg mx-auto">
               <div className="relative w-full aspect-square bg-slate-100 rounded-xl overflow-hidden">
                  <img 
                    src={finalCompositeImage} 
                    alt="Final Studio Result" 
                    className="w-full h-full object-cover"
                  />
               </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href={finalCompositeImage}
                download={`notato-studio-${Date.now()}.jpg`}
                className="flex items-center justify-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-xl font-semibold hover:bg-slate-800 transition-colors shadow-lg hover:scale-105 transform duration-200"
              >
                <Download size={18} /> Pobierz zdjęcie
              </a>
              <button 
                onClick={resetProcess}
                className="flex items-center justify-center gap-2 bg-white border border-slate-300 text-slate-700 px-6 py-4 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
              >
                <RefreshCcw size={18} /> Zacznij od nowa
              </button>
            </div>
            
            <div className="mt-8 text-center">
               <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Użyty styl</p>
               <p className="text-sm text-slate-500 mt-2 italic">
                 {styles[selectedStyleIndex].title}
               </p>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default AIProductStudio;