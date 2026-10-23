import { Folders } from "@phosphor-icons/react/dist/ssr";
import { EmptyState, PageHeader, Screen } from "@/components/shell/page-header";

export default function ProjectsPage() {
  return (
    <Screen>
      <PageHeader title="Projects" />
      <EmptyState
        icon={<Folders weight="duotone" className="size-7" />}
        title="No project views yet"
        body="Project cards, the timeline and the New project wizard arrive in Phase 2."
      />
    </Screen>
  );
}
