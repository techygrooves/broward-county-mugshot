export interface ChargeCategory {
  slug: string;
  name: string;
  shortName: string;
  description: string;
  keywords: string[];
}

export const CHARGE_CATEGORIES: ChargeCategory[] = [
  {
    slug: "dui",
    name: "DUI Arrests in Broward County",
    shortName: "DUI",
    description:
      "Public booking records from Broward County that include driving under the influence (DUI) related charges under Florida Statute 316.193.",
    keywords: ["dui", "driving under the influence", "316.193", "impair"],
  },
  {
    slug: "battery",
    name: "Battery Arrests in Broward County",
    shortName: "Battery",
    description:
      "Public booking records from Broward County that include battery-related charges, such as simple battery or aggravated battery under Florida Statutes 784.03 and 784.045.",
    keywords: ["battery", "784.03", "784.045"],
  },
  {
    slug: "domestic-violence",
    name: "Domestic Violence Arrests in Broward County",
    shortName: "Domestic Violence",
    description:
      "Public booking records from Broward County that include domestic violence related charges, including domestic battery and violation of protective orders.",
    keywords: ["domestic", "741.28", "741.31"],
  },
  {
    slug: "theft",
    name: "Theft Arrests in Broward County",
    shortName: "Theft",
    description:
      "Public booking records from Broward County that include theft-related charges, such as petit theft, grand theft, or retail theft under Florida Statute 812.014.",
    keywords: ["theft", "812.014", "shoplift", "stolen"],
  },
  {
    slug: "drug-charges",
    name: "Drug Charge Arrests in Broward County",
    shortName: "Drug Charges",
    description:
      "Public booking records from Broward County that include controlled substance charges under Florida Statute Chapter 893, including possession, sale, and trafficking.",
    keywords: ["drug", "controlled substance", "893.13", "893.147", "cannabis", "cocaine", "trafficking", "paraphernalia"],
  },
  {
    slug: "probation-violation",
    name: "Probation Violation Arrests in Broward County",
    shortName: "Probation Violation",
    description:
      "Public booking records from Broward County that include violation of probation or community control charges under Florida Statute 948.06.",
    keywords: ["probation", "948.06", "community control", "vop"],
  },
  {
    slug: "traffic-offenses",
    name: "Traffic Offense Arrests in Broward County",
    shortName: "Traffic Offenses",
    description:
      "Public booking records from Broward County that include criminal traffic charges, such as driving while license suspended, reckless driving, or leaving the scene.",
    keywords: ["driving while license", "322.34", "reckless driving", "316.192", "leaving the scene", "traffic"],
  },
  {
    slug: "weapons-charges",
    name: "Weapons Charge Arrests in Broward County",
    shortName: "Weapons Charges",
    description:
      "Public booking records from Broward County that include firearm and weapons charges under Florida Statute Chapter 790.",
    keywords: ["firearm", "weapon", "790.", "concealed"],
  },
  {
    slug: "fraud",
    name: "Fraud Arrests in Broward County",
    shortName: "Fraud",
    description:
      "Public booking records from Broward County that include fraud-related charges, such as credit card fraud, identity theft, or worthless checks.",
    keywords: ["fraud", "817.", "forgery", "counterfeit", "identity theft"],
  },
  {
    slug: "burglary",
    name: "Burglary Arrests in Broward County",
    shortName: "Burglary",
    description:
      "Public booking records from Broward County that include burglary charges under Florida Statute 810.02.",
    keywords: ["burglary", "810.02"],
  },
];

export function getCategory(slug: string): ChargeCategory | undefined {
  return CHARGE_CATEGORIES.find((c) => c.slug === slug);
}

export function categorize(chargesText: string | null): ChargeCategory[] {
  if (!chargesText) return [];
  const text = chargesText.toLowerCase();
  return CHARGE_CATEGORIES.filter((c) =>
    c.keywords.some((k) => text.includes(k.toLowerCase()))
  );
}
