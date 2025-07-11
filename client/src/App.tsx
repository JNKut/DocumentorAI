import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import WidgetPage from "@/pages/widget";
import EmbedWidget from "@/components/EmbedWidget";
import WidgetOnlyPage from "@/pages/widget-only";

function Router() {
  return (
    <Switch>
      <Route path="/" component={WidgetPage} />
      <Route path="/embed" component={EmbedWidget} />
      <Route path="/widget" component={WidgetOnlyPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
