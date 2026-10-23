import { Table } from "@phosphor-icons/react/dist/ssr";
import { EmptyState, PageHeader, Screen } from "@/components/shell/page-header";

export default function TimesheetPage() {
  return (
    <Screen>
      <PageHeader title="Timesheet" />
      <EmptyState
        icon={<Table weight="duotone" className="size-7" />}
        title="Nothing logged yet"
        body="Day, Week and Month views, Submit month and PDF/CSV export arrive in Phase 3."
      />
    </Screen>
  );
}
