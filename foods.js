/**
 * TriTrack - Popüler Sporcu ve Sağlık Besinleri Listesi (Türkiye)
 * 
 * Bu dosya, spor beslenmesinde sıkça kullanılan besinleri ve bunların 100g ya da belirtilen porsiyon bazındaki
 * besin değerlerini (Kalori, Protein, Karbonhidrat, Yağ) içermektedir.
 * 
 * Her besin öğesi şu özelliklere sahiptir:
 * - id: Benzersiz kimlik (string)
 * - name: Besin adı ve porsiyon miktarı (Turkish)
 * - calories: Toplam enerji değeri (kcal)
 * - protein: Protein miktarı (gram)
 * - carbs: Karbonhidrat miktarı (gram)
 * - fat: Yağ miktarı (gram)
 * - category: Besin kategorisi ("Protein", "Karbonhidrat", "Yağlar", "Meyve/Sebze", "Takviye")
 */

const LOCAL_FOODS = [
  // --- PROTEİN KAYNAKLARI ---
  {
    id: "prot_tavuk_gogsu",
    name: "Tavuk Göğsü (Izgara, 100g)",
    calories: 165,
    protein: 31.0,
    carbs: 0.0,
    fat: 3.6,
    category: "Protein"
  },
  {
    id: "prot_hindi_gogsu",
    name: "Hindi Göğsü (Izgara, 100g)",
    calories: 135,
    protein: 30.0,
    carbs: 0.0,
    fat: 1.5,
    category: "Protein"
  },
  {
    id: "prot_hindi_fume",
    name: "Hindi Füme (100g)",
    calories: 110,
    protein: 16.0,
    carbs: 2.0,
    fat: 3.0,
    category: "Protein"
  },
  {
    id: "prot_yumurta_aki",
    name: "Yumurta Akı (1 adet, haşlanmış)",
    calories: 17,
    protein: 4.0,
    carbs: 0.2,
    fat: 0.1,
    category: "Protein"
  },
  {
    id: "prot_yumurta_butun",
    name: "Yumurta (1 adet, bütün, haşlanmış)",
    calories: 78,
    protein: 6.3,
    carbs: 0.6,
    fat: 5.3,
    category: "Protein"
  },
  {
    id: "prot_lor_peyniri",
    name: "Lor Peyniri (Yağsız, 100g)",
    calories: 85,
    protein: 14.0,
    carbs: 3.0,
    fat: 1.5,
    category: "Protein"
  },
  {
    id: "prot_suzme_peynir",
    name: "Süzme Peynir (Yarım yağlı, 100g)",
    calories: 200,
    protein: 11.0,
    carbs: 3.0,
    fat: 16.0,
    category: "Protein"
  },
  {
    id: "prot_cokelek",
    name: "Çökelek (100g)",
    calories: 120,
    protein: 18.0,
    carbs: 2.0,
    fat: 4.0,
    category: "Protein"
  },
  {
    id: "prot_ton_baligi",
    name: "Ton Balığı (Konserve, süzülmüş, 100g)",
    calories: 180,
    protein: 26.0,
    carbs: 0.0,
    fat: 8.0,
    category: "Protein"
  },
  {
    id: "prot_somon",
    name: "Somon Izgara (100g)",
    calories: 206,
    protein: 22.0,
    carbs: 0.0,
    fat: 13.0,
    category: "Protein"
  },
  {
    id: "prot_biftek",
    name: "Dana Biftek (Izgara, 100g)",
    calories: 250,
    protein: 26.0,
    carbs: 0.0,
    fat: 15.0,
    category: "Protein"
  },
  {
    id: "prot_dana_kiyma",
    name: "Kıyma (Yağsız dana, pişmiş, 100g)",
    calories: 200,
    protein: 25.0,
    carbs: 0.0,
    fat: 11.0,
    category: "Protein"
  },
  {
    id: "prot_suzme_yogurt_az",
    name: "Süzme Yoğurt (Yarım yağlı, 100g)",
    calories: 85,
    protein: 8.0,
    carbs: 4.0,
    fat: 3.5,
    category: "Protein"
  },
  {
    id: "prot_suzme_yogurt_tam",
    name: "Süzme Yoğurt (Tam yağlı, 100g)",
    calories: 115,
    protein: 7.0,
    carbs: 4.0,
    fat: 7.5,
    category: "Protein"
  },
  {
    id: "prot_kefir",
    name: "Kefir (Sade, 250ml)",
    calories: 135,
    protein: 8.0,
    carbs: 10.0,
    fat: 6.0,
    category: "Protein"
  },
  {
    id: "prot_sut",
    name: "Süt (Yarım yağlı, 250ml)",
    calories: 115,
    protein: 7.5,
    carbs: 11.8,
    fat: 3.8,
    category: "Protein"
  },
  {
    id: "prot_quark",
    name: "Quark (Sade, 100g)",
    calories: 65,
    protein: 8.5,
    carbs: 4.0,
    fat: 1.5,
    category: "Protein"
  },
  {
    id: "prot_protein_bar",
    name: "Protein Bar (Standart, 60g)",
    calories: 220,
    protein: 20.0,
    carbs: 18.0,
    fat: 7.0,
    category: "Protein"
  },

  // --- KARBONHİDRAT KAYNAKLARI ---
  {
    id: "carb_yulaf",
    name: "Yulaf Ezmesi (Çiğ, 100g)",
    calories: 370,
    protein: 12.5,
    carbs: 60.0,
    fat: 7.0,
    category: "Karbonhidrat"
  },
  {
    id: "carb_karabugday",
    name: "Karabuğday (Greçka, haşlanmış, 100g)",
    calories: 100,
    protein: 3.5,
    carbs: 20.0,
    fat: 0.6,
    category: "Karbonhidrat"
  },
  {
    id: "carb_bulgur",
    name: "Bulgur (Haşlanmış, 100g)",
    calories: 120,
    protein: 3.0,
    carbs: 25.0,
    fat: 0.4,
    category: "Karbonhidrat"
  },
  {
    id: "carb_pirinc_basmati",
    name: "Pirinç (Basmati, haşlanmış, 100g)",
    calories: 130,
    protein: 2.7,
    carbs: 28.0,
    fat: 0.3,
    category: "Karbonhidrat"
  },
  {
    id: "carb_tatli_patates",
    name: "Tatlı Patates (Fırınlanmış, 100g)",
    calories: 90,
    protein: 2.0,
    carbs: 21.0,
    fat: 0.2,
    category: "Karbonhidrat"
  },
  {
    id: "carb_patates_haslanmis",
    name: "Patates (Haşlanmış, 100g)",
    calories: 87,
    protein: 2.0,
    carbs: 20.0,
    fat: 0.1,
    category: "Karbonhidrat"
  },
  {
    id: "carb_kinoa",
    name: "Kinoa (Haşlanmış, 100g)",
    calories: 120,
    protein: 4.4,
    carbs: 21.0,
    fat: 1.9,
    category: "Karbonhidrat"
  },
  {
    id: "carb_pirinc_patlagi",
    name: "Pirinç Patlağı (Sade, 100g)",
    calories: 380,
    protein: 8.0,
    carbs: 80.0,
    fat: 3.0,
    category: "Karbonhidrat"
  },
  {
    id: "carb_makarna_tam_bugday",
    name: "Makarna (Tam buğday, haşlanmış, 100g)",
    calories: 124,
    protein: 5.3,
    carbs: 26.0,
    fat: 0.5,
    category: "Karbonhidrat"
  },
  {
    id: "carb_ekmek_tam_tahilli",
    name: "Ekmek (Tam tahıllı, 1 dilim, 30g)",
    calories: 75,
    protein: 3.0,
    carbs: 13.0,
    fat: 1.0,
    category: "Karbonhidrat"
  },
  {
    id: "carb_nohut",
    name: "Nohut (Haşlanmış, 100g)",
    calories: 164,
    protein: 8.9,
    carbs: 27.0,
    fat: 2.6,
    category: "Karbonhidrat"
  },
  {
    id: "carb_yesil_mercimek",
    name: "Yeşil Mercimek (Haşlanmış, 100g)",
    calories: 116,
    protein: 9.0,
    carbs: 20.0,
    fat: 0.4,
    category: "Karbonhidrat"
  },
  {
    id: "carb_kirmizi_mercimek",
    name: "Kırmızı Mercimek (Haşlanmış, 100g)",
    calories: 116,
    protein: 9.0,
    carbs: 20.0,
    fat: 0.4,
    category: "Karbonhidrat"
  },
  {
    id: "carb_kuru_fasulye",
    name: "Kuru Fasulye (Haşlanmış, 100g)",
    calories: 139,
    protein: 9.7,
    carbs: 25.0,
    fat: 0.4,
    category: "Karbonhidrat"
  },

  // --- SAĞLIKLI YAĞ KAYNAKLARI ---
  {
    id: "fat_fistik_ezmesi",
    name: "Fıstık Ezmesi (Şekersiz, 100g)",
    calories: 588,
    protein: 25.0,
    carbs: 20.0,
    fat: 50.0,
    category: "Yağlar"
  },
  {
    id: "fat_badem_cig",
    name: "Badem (Çiğ, 100g)",
    calories: 579,
    protein: 21.0,
    carbs: 22.0,
    fat: 49.0,
    category: "Yağlar"
  },
  {
    id: "fat_ceviz_ici",
    name: "Ceviz İçi (100g)",
    calories: 654,
    protein: 15.0,
    carbs: 14.0,
    fat: 65.0,
    category: "Yağlar"
  },
  {
    id: "fat_findik_cig",
    name: "Fındık (Çiğ, 100g)",
    calories: 628,
    protein: 15.0,
    carbs: 17.0,
    fat: 61.0,
    category: "Yağlar"
  },
  {
    id: "fat_kabak_cekirdegi",
    name: "Kabak Çekirdeği (Çiğ, 100g)",
    calories: 559,
    protein: 30.0,
    carbs: 11.0,
    fat: 49.0,
    category: "Yağlar"
  },
  {
    id: "fat_zeytinyagi",
    name: "Zeytinyağı (1 yemek kaşığı, 10g)",
    calories: 88,
    protein: 0.0,
    carbs: 0.0,
    fat: 10.0,
    category: "Yağlar"
  },
  {
    id: "fat_hindistan_cevizi_yagi",
    name: "Hindistan Cevizi Yağı (1 yemek kaşığı, 10g)",
    calories: 86,
    protein: 0.0,
    carbs: 0.0,
    fat: 10.0,
    category: "Yağlar"
  },
  {
    id: "fat_avokado",
    name: "Avokado (1 adet orta boy, 150g)",
    calories: 240,
    protein: 3.0,
    carbs: 12.0,
    fat: 22.0,
    category: "Yağlar"
  },
  {
    id: "fat_siyah_zeytin",
    name: "Siyah Zeytin (10 adet, 30g)",
    calories: 35,
    protein: 0.3,
    carbs: 2.0,
    fat: 3.5,
    category: "Yağlar"
  },
  {
    id: "fat_chia_tohumu",
    name: "Chia Tohumu (10g)",
    calories: 49,
    protein: 1.7,
    carbs: 4.2,
    fat: 3.1,
    category: "Yağlar"
  },
  {
    id: "fat_keten_tohumu",
    name: "Keten Tohumu (10g)",
    calories: 53,
    protein: 1.8,
    carbs: 2.9,
    fat: 4.2,
    category: "Yağlar"
  },
  {
    id: "fat_labne_az",
    name: "Labne (Yarım yağlı, 100g)",
    calories: 180,
    protein: 5.0,
    carbs: 4.0,
    fat: 16.0,
    category: "Yağlar"
  },

  // --- MEYVE VE SEBZELER ---
  {
    id: "veg_muz",
    name: "Muz (1 adet orta boy, 120g)",
    calories: 105,
    protein: 1.3,
    carbs: 27.0,
    fat: 0.4,
    category: "Meyve/Sebze"
  },
  {
    id: "veg_elma",
    name: "Elma (1 adet orta boy, 150g)",
    calories: 78,
    protein: 0.4,
    carbs: 21.0,
    fat: 0.3,
    category: "Meyve/Sebze"
  },
  {
    id: "veg_cilek",
    name: "Çilek (100g)",
    calories: 32,
    protein: 0.7,
    carbs: 8.0,
    fat: 0.3,
    category: "Meyve/Sebze"
  },
  {
    id: "veg_yaban_mersini",
    name: "Yaban Mersini (100g)",
    calories: 57,
    protein: 0.7,
    carbs: 14.0,
    fat: 0.3,
    category: "Meyve/Sebze"
  },
  {
    id: "veg_portakal",
    name: "Portakal (1 adet orta boy, 130g)",
    calories: 62,
    protein: 1.2,
    carbs: 15.0,
    fat: 0.2,
    category: "Meyve/Sebze"
  },
  {
    id: "veg_brokoli",
    name: "Brokoli (Haşlanmış, 100g)",
    calories: 35,
    protein: 2.4,
    carbs: 7.0,
    fat: 0.4,
    category: "Meyve/Sebze"
  },
  {
    id: "veg_ispanak",
    name: "Ispanak (Haşlanmış, 100g)",
    calories: 23,
    protein: 3.0,
    carbs: 3.8,
    fat: 0.3,
    category: "Meyve/Sebze"
  },
  {
    id: "veg_salatalik",
    name: "Salatalık (100g)",
    calories: 15,
    protein: 0.7,
    carbs: 3.6,
    fat: 0.1,
    category: "Meyve/Sebze"
  },
  {
    id: "veg_domates",
    name: "Domates (100g)",
    calories: 18,
    protein: 0.9,
    carbs: 3.9,
    fat: 0.2,
    category: "Meyve/Sebze"
  },
  {
    id: "veg_kuskonmaz",
    name: "Kuşkonmaz (Izgara, 100g)",
    calories: 20,
    protein: 2.2,
    carbs: 3.9,
    fat: 0.1,
    category: "Meyve/Sebze"
  },

  // --- SPORCU TAKVİYELERİ ---
  {
    id: "supp_whey_protein",
    name: "Whey Protein Tozu (1 ölçek, 30g)",
    calories: 120,
    protein: 24.0,
    carbs: 2.0,
    fat: 1.5,
    category: "Takviye"
  },
  {
    id: "supp_kreatin",
    name: "Kreatin Monohidrat (1 porsiyon, 5g)",
    calories: 0,
    protein: 0.0,
    carbs: 0.0,
    fat: 0.0,
    category: "Takviye"
  },
  {
    id: "supp_bcaa",
    name: "BCAA (1 porsiyon, 5g)",
    calories: 20,
    protein: 5.0,
    carbs: 0.0,
    fat: 0.0,
    category: "Takviye"
  },
  {
    id: "supp_l_karnitin",
    name: "L-Karnitin (1 ampul, 2000mg)",
    calories: 15,
    protein: 0.0,
    carbs: 3.5,
    fat: 0.0,
    category: "Takviye"
  }
];

// Dosyanın modül olarak veya düz script olarak kullanımına uygunluk sağlaması için:
if (typeof module !== "undefined" && module.exports) {
  module.exports = { LOCAL_FOODS };
}
