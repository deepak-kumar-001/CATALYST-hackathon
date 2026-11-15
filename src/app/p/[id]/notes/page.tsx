import Portal from "@/components/Portal";
export default function NotesPage({ params }: { params: { id: string } }) { return <Portal profileId={params.id} section="notes" />; }
