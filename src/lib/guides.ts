export interface Guide {
  slug: string;
  title: string;
  metaTitle: string;
  description: string;
  updated: string;
  sections: { heading: string; paragraphs: string[] }[];
}

export const GUIDES: Guide[] = [
  {
    slug: "how-to-find-broward-recent-arrests",
    title: "How to Find Recent Arrests in Broward County",
    metaTitle: "Broward County Arrest Search — How to Find Recent Broward Arrests",
    description:
      "A practical guide to finding recent Broward County arrest and booking information using official Broward Sheriff's Office public records.",
    updated: "2026-07-06",
    sections: [
      {
        heading: "Official Broward Sheriff's Office sources",
        paragraphs: [
          "The Broward Sheriff's Office (BSO) publishes public booking information through its official Booking Blotter at bookingblotter.sheriff.org and its Arrest Search tool at apps.sheriff.org/arrestsearch. These official tools are always the most current and authoritative sources for Broward County booking information.",
          "The Booking Blotter shows people recently booked into Broward County jail facilities. The Arrest Search tool lets you look up records by name and booking date, and includes charge, bond, custody, and court information.",
        ],
      },
      {
        heading: "How this site fits in",
        paragraphs: [
          "This website organizes public Broward arrest information into a searchable, readable format with links back to the official source for every record. It is a convenience resource, not an official government site. Always verify details against the official Broward Sheriff's Office record before relying on them.",
          "Records shown here may lag the official source, and records that have been sealed, expunged, or corrected may still appear until our data refresh runs. If you see an error, use the removal request page to let us know — the process is free.",
        ],
      },
      {
        heading: "What arrest records do and do not mean",
        paragraphs: [
          "An arrest record documents that a person was booked into custody. It is not evidence of guilt. Charges are frequently reduced, dismissed, or never filed by the State Attorney. Under U.S. law, every person is presumed innocent unless and until convicted in court.",
        ],
      },
    ],
  },
  {
    slug: "what-to-do-after-an-arrest-in-broward-county",
    title: "What to Do After an Arrest in Broward County",
    metaTitle: "Arrested in Broward County? Steps to Take After a Broward Arrest",
    description:
      "Practical first steps after an arrest in Broward County, Florida: first appearance, bond, finding counsel, and protecting your record.",
    updated: "2026-07-06",
    sections: [
      {
        heading: "The first 24–48 hours",
        paragraphs: [
          "After booking at a Broward County jail facility, a first appearance hearing generally happens within 24 hours. A judge reviews probable cause and sets or reviews bond conditions. Family members can check custody status through the official Broward Sheriff's Office inquiry tools.",
          "Bond may be posted in cash or through a licensed bail bond agent. Some charges, such as domestic violence offenses, require a first appearance before bond can be set.",
        ],
      },
      {
        heading: "Speak with a criminal defense attorney early",
        paragraphs: [
          "Early legal advice can matter enormously — from what to say (and not say) to investigators, to negotiating with the State Attorney before charges are formally filed. If you cannot afford a lawyer, you may qualify for representation by the Broward County Public Defender.",
          "Arrested in Broward County? You may have legal options. Speak with a Florida criminal defense attorney about your case, record sealing, expungement, and online record concerns.",
        ],
      },
      {
        heading: "Protecting your record going forward",
        paragraphs: [
          "If your case ends without a conviction, you may be eligible to seal or expunge the record under Florida law. See our guide on record sealing versus expungement for how the two differ and who qualifies.",
          "This page is general information, not legal advice. Every case is different — consult a licensed Florida attorney about your specific situation.",
        ],
      },
    ],
  },
  {
    slug: "broward-mugshot-removal-guide",
    title: "Broward Mugshot Removal Guide",
    metaTitle: "Broward Mugshot Removal Guide — Free Removal Request Process",
    description:
      "How to request removal of a Broward County mugshot or arrest record from this website — free of charge — and what Florida law says about mugshot removal.",
    updated: "2026-07-06",
    sections: [
      {
        heading: "Removal from this website is free",
        paragraphs: [
          "We never charge to review or remove a record. Florida law (Fla. Stat. § 943.0593) prohibits websites from demanding payment to remove arrest booking photographs, and we support that policy. Use our removal request page to submit a free request.",
          "Good reasons for removal include: charges dropped or dismissed, acquittal, sealed or expunged records, mistaken identity, juvenile status, safety concerns, or simple inaccuracy. Include documentation notes where possible — it speeds review.",
        ],
      },
      {
        heading: "What happens after you submit a request",
        paragraphs: [
          "A reviewer looks at every request. If approved, the record (or just the booking photo) is hidden from the site and the record identifiers are added to a suppression list so future data refreshes do not re-publish it.",
          "Removal from this website does not remove the underlying official record. To address the official record, you generally need to pursue sealing or expungement through the Florida Department of Law Enforcement and the courts.",
        ],
      },
      {
        heading: "Removing records from other websites",
        paragraphs: [
          "Other mugshot websites are independent of this one. Under Florida Statute 943.0595 and related law, you can send a written removal request to sites that publish arrest booking photos; qualifying sites must remove the photo without charge within 10 days of a valid request, and noncompliance can carry penalties.",
          "An attorney experienced with online record issues can help coordinate removals, cease-and-desist letters, and search engine de-indexing requests.",
        ],
      },
    ],
  },
  {
    slug: "florida-mugshot-removal-law",
    title: "Florida Mugshot Removal Law",
    metaTitle: "Florida Mugshot Removal Law — Your Rights Under Florida Statutes",
    description:
      "An overview of Florida law on mugshot publication and removal, including the ban on charging fees for booking photo removal.",
    updated: "2026-07-06",
    sections: [
      {
        heading: "Florida bans pay-for-removal",
        paragraphs: [
          "Florida law prohibits the practice of charging people to take down their booking photos. Under Fla. Stat. § 943.0593, a person or entity that publishes arrest booking photographs and solicits or accepts a fee to remove them violates Florida law, and affected people can demand removal in writing.",
          "After a valid written request, a qualifying publisher must remove the booking photograph without charge, generally within 10 days. Failure to comply can expose the publisher to civil penalties and enforcement action.",
        ],
      },
      {
        heading: "Public records and the First Amendment",
        paragraphs: [
          "Arrest records and booking photos are generally public records in Florida under Chapter 119, and truthful publication of public records is lawful. The law targets the abusive pay-to-remove business model, not public access to records.",
          "Sealed and expunged records are different: once a record is sealed or expunged, it is no longer a public record, and continuing publication may be actionable. Notify any website publishing a sealed or expunged record and request removal.",
        ],
      },
      {
        heading: "This site's policy",
        paragraphs: [
          "This website follows a stricter policy than the law requires: all removal requests are free, reviewed by a person, and approved removals are added to a suppression list to prevent re-publication. This page is general legal information, not legal advice.",
        ],
      },
    ],
  },
  {
    slug: "record-sealing-vs-expungement-florida",
    title: "Record Sealing vs. Expungement in Florida",
    metaTitle: "Broward Record Sealing and Expungement — Sealing vs. Expungement in Florida",
    description:
      "The difference between sealing and expunging a criminal record in Florida, who qualifies, and how the process works in Broward County.",
    updated: "2026-07-06",
    sections: [
      {
        heading: "Two different remedies",
        paragraphs: [
          "Sealing (Fla. Stat. § 943.059) makes the record confidential — it still exists, but most employers and the public cannot see it. Expungement (Fla. Stat. § 943.0585) goes further: the court-ordered destruction of the record, with only a confidential FDLE copy retained.",
          "Broadly, expungement is available when charges were dropped, dismissed, or never filed. Sealing is available for some cases that ended with adjudication withheld. A conviction (adjudication of guilt) generally makes a record ineligible for either remedy.",
        ],
      },
      {
        heading: "The process in Broward County",
        paragraphs: [
          "The process starts with a Certificate of Eligibility from the Florida Department of Law Enforcement (FDLE), followed by a petition in Broward County circuit court. Most people may seal or expunge only one arrest record in their lifetime, so it pays to get the process right.",
          "Once a record is sealed or expunged, you may lawfully deny the arrest in most circumstances, and websites publishing the record should be notified to remove it.",
        ],
      },
      {
        heading: "Getting help",
        paragraphs: [
          "Eligibility rules are technical and mistakes can waste your single opportunity. Speak with a Florida criminal defense attorney about your case, record sealing, expungement, and online record concerns. This page is general information, not legal advice.",
        ],
      },
    ],
  },
  {
    slug: "broward-criminal-defense-help",
    title: "Broward Criminal Defense Help",
    metaTitle: "Broward Criminal Defense Help — Finding a Defense Attorney in Broward County",
    description:
      "How to find criminal defense help in Broward County, Florida, including private counsel, the public defender, and free resources.",
    updated: "2026-07-06",
    sections: [
      {
        heading: "Your right to counsel",
        paragraphs: [
          "Anyone facing criminal charges in Broward County has the right to an attorney. If you cannot afford one, the Broward County Public Defender's Office provides representation to qualifying defendants. You can request a public defender at your first appearance.",
          "For those who can retain private counsel, look for attorneys who regularly practice in Broward County criminal courts and who handle your specific charge type — DUI, domestic violence, drug offenses, and fraud cases each have their own defense landscape.",
        ],
      },
      {
        heading: "Questions worth asking an attorney",
        paragraphs: [
          "How often do you handle cases like mine in Broward County? What are the realistic outcomes? Can this case be resolved before formal charges are filed? Will my case affect my license, immigration status, or employment? Could I be eligible for a diversion program, sealing, or expungement afterward?",
          "Arrested in Broward County? You may have legal options. Speak with a Florida criminal defense attorney about your case, record sealing, expungement, and online record concerns.",
        ],
      },
      {
        heading: "Free and low-cost resources",
        paragraphs: [
          "Resources include the Broward County Public Defender, Legal Aid Service of Broward County, and the Florida Bar Lawyer Referral Service. This website does not provide legal advice and is not a lawyer referral service.",
        ],
      },
    ],
  },
  {
    slug: "why-arrest-information-may-be-outdated",
    title: "Why Arrest Information May Be Outdated or Incorrect",
    metaTitle: "Why Broward Arrest Information May Be Outdated or Incorrect",
    description:
      "Why public arrest information can be incomplete, outdated, or wrong — and why an arrest record is never proof of guilt.",
    updated: "2026-07-06",
    sections: [
      {
        heading: "Arrest data is a snapshot",
        paragraphs: [
          "Booking information is captured at the moment of arrest, before any court has looked at the case. Charges listed at booking are often changed, reduced, or never filed at all. Bond amounts change at first appearance. Custody status changes daily.",
          "Data published on any third-party website — including this one — reflects the source at the time it was collected. The official Broward Sheriff's Office record is always more current.",
        ],
      },
      {
        heading: "Common reasons a record is wrong or stale",
        paragraphs: [
          "Charges dropped or amended after booking; cases declined by the State Attorney; identity errors or shared names; records later sealed or expunged; clerical errors in the original booking data; and delays between official updates and website refreshes.",
          "An arrest does not mean the person was convicted. Treat every arrest record with that presumption in mind, especially in employment, housing, and personal decisions — and note that using arrest records for employment or tenant screening is regulated by the federal Fair Credit Reporting Act, which this site is not intended to support.",
        ],
      },
      {
        heading: "How to get a record corrected or removed here",
        paragraphs: [
          "If a record on this site is wrong, outdated, sealed, or expunged, submit a free removal request. Approved requests are hidden from the site and suppressed from future data refreshes.",
        ],
      },
    ],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
