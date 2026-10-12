export type Service = {
  id: string;
  name: string;
  duration: string;
  price: string;
  copy: string;
  addOn?: boolean;
};

export const SERVICES: Service[] = [
  {
    id: "gel",
    name: "Signature Gel Manicure",
    duration: "60 min",
    price: "€42",
    copy: "Shape, cuticle care and a long-wear gel in any lab shade.",
  },
  {
    id: "biab",
    name: "BIAB Strength Overlay",
    duration: "75 min",
    price: "€55",
    copy: "A builder gel that lets weak or bitten nails grow out strong.",
  },
  {
    id: "aurora",
    name: "Aurora & Chrome Finish",
    duration: "+20 min",
    price: "€12",
    copy: "A thin-film top layer that shifts colour as your hands move.",
    addOn: true,
  },
  {
    id: "art",
    name: "Hand-painted Nail Art",
    duration: "from 30 min",
    price: "from €15",
    copy: "Florals, fine lines and tiny botanicals, drawn freehand.",
  },
  {
    id: "pedicure",
    name: "Garden Pedicure",
    duration: "70 min",
    price: "€48",
    copy: "A warm soak, gentle exfoliation, polish and a long calf massage.",
  },
  {
    id: "brows",
    name: "Brow Shape & Tint",
    duration: "30 min",
    price: "€26",
    copy: "Mapped to your face, tinted to your colouring.",
  },
];

export type Artist = {
  id: string;
  name: string;
  role: string;
  copy: string;
  colors: [string, string, string];
  initial: string;
};

export const ARTISTS: Artist[] = [
  {
    id: "mira",
    name: "Mira Okafor",
    role: "Studio lead & colourist",
    copy: "Mixes every lab shade herself. Ask her about undertones.",
    colors: ["#8c2457", "#d9668f", "#f4c7b8"],
    initial: "M",
  },
  {
    id: "jun",
    name: "Jun Halvorsen",
    role: "Nail artist",
    copy: "Freehand florals and fine-line work. Booked out on Fridays.",
    colors: ["#2f7a8a", "#a9c29a", "#eef0d8"],
    initial: "J",
  },
  {
    id: "selin",
    name: "Selin Arda",
    role: "Pedicure & brows",
    copy: "Calm, careful and the best hand massage in the building.",
    colors: ["#6e2a4f", "#b79bd8", "#efe2f6"],
    initial: "S",
  },
];

export const FAQ = [
  {
    q: "How long does gel last?",
    a: "Two to three weeks for most people. We remove it gently, without drilling the natural nail.",
  },
  {
    q: "Can I bring my own design?",
    a: "Yes. Send a picture with your booking and we'll plan the time it needs.",
  },
  {
    q: "What if I'm running late?",
    a: "Message us. Up to fifteen minutes we can usually keep the full service.",
  },
  {
    q: "Is the aurora finish safe?",
    a: "It's a cosmetic top coat with a fine shimmer pigment, cured like any gel.",
  },
];

export type Review = { quote: string; name: string; service: string; shadeId: string };

/** Concept-project reviews (the footnote on the page says so). */
export const REVIEWS: Review[] = [
  {
    quote: "I walked in with a screenshot and walked out with the exact shade — they mixed it in front of me.",
    name: "Dana",
    service: "Signature Gel",
    shadeId: "fig",
  },
  {
    quote: "Three weeks and not a single chip. And nobody rushed me once.",
    name: "Leo",
    service: "BIAB Overlay",
    shadeId: "bare",
  },
  {
    quote: "The aurora finish is ridiculous in daylight. Strangers ask about it.",
    name: "Priya",
    service: "Aurora & Chrome",
    shadeId: "tidepool",
  },
];
