"use server";

import { getSupabase } from "@/lib/supabase";

export interface FormState {
  ok: boolean;
  message: string;
}

/**
 * Public, always-free removal request. Creates a removal_requests row and
 * flags the arrest record so admins see it immediately.
 */
export async function submitRemovalRequest(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const requesterName = String(formData.get("requester_name") ?? "").trim();
  const requesterEmail = String(formData.get("requester_email") ?? "").trim();
  const requesterPhone = String(formData.get("requester_phone") ?? "").trim();
  const relationship = String(formData.get("relationship_to_person") ?? "").trim();
  const proofNotes = String(formData.get("proof_notes") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const arrestId = String(formData.get("arrest_id") ?? "").trim();
  const arrestNumber = String(formData.get("arrest_number") ?? "").trim();

  if (!requesterName || !requesterEmail) {
    return { ok: false, message: "Please provide your name and email address." };
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(requesterEmail)) {
    return { ok: false, message: "Please provide a valid email address." };
  }
  if (!arrestId && !arrestNumber && !message) {
    return {
      ok: false,
      message:
        "Please identify the record: use the record link, provide the arrest number, or describe the record in the message field.",
    };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return {
      ok: false,
      message:
        "The database is not configured yet (demo mode). Your request was not saved — please try again later or contact the site operator directly.",
    };
  }

  try {
    let resolvedArrestId: string | null = null;
    if (arrestId) {
      const { data } = await supabase
        .from("arrests")
        .select("id")
        .eq("id", arrestId)
        .maybeSingle();
      resolvedArrestId = data?.id ?? null;
    }
    if (!resolvedArrestId && arrestNumber) {
      const { data } = await supabase
        .from("arrests")
        .select("id")
        .eq("arrest_number", arrestNumber)
        .maybeSingle();
      resolvedArrestId = data?.id ?? null;
    }

    const { error } = await supabase.from("removal_requests").insert({
      arrest_id: resolvedArrestId,
      requester_name: requesterName,
      requester_email: requesterEmail,
      requester_phone: requesterPhone || null,
      relationship_to_person: relationship || null,
      proof_notes: proofNotes || null,
      message: [message, arrestNumber ? `Arrest number provided: ${arrestNumber}` : null]
        .filter(Boolean)
        .join("\n"),
      status: "pending",
    });
    if (error) throw error;

    if (resolvedArrestId) {
      await supabase
        .from("arrests")
        .update({
          removal_requested: true,
          removal_requested_at: new Date().toISOString(),
        })
        .eq("id", resolvedArrestId);
    }

    return {
      ok: true,
      message:
        "Your removal request has been received. Requests are reviewed by a person, free of charge. You do not need to pay anyone to complete this process.",
    };
  } catch (e) {
    console.error("submitRemovalRequest failed:", e);
    return {
      ok: false,
      message: "Something went wrong saving your request. Please try again.",
    };
  }
}
