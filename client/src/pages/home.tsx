import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPlayerSchema, type Player, type InsertPlayer } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { formatPosition, getPositionColor } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

import { 
  Users, 
  UserPlus, 
  CheckCircle, 
  XCircle, 
  Phone, 
  Edit, 
  Trash2,
  RotateCcw,
  Download,
  Search,
  Zap,
  Target,
  Shield,
  Activity,
  MessageSquare,
  Clock,
  TrendingUp,
  Lightbulb,
  Star
} from "lucide-react";

interface Stats {
  totalPlayers: number;
  checkedInPlayers: number;
  attendanceRate: number;
  positionCounts: Record<string, number>;
}

interface FormationPlayer {
  id: number;
  name: string;
  position: string;
  jerseyNumber: number;
}

interface Formation {
  name: string;
  positions: {
    goalkeeper: number;
    defender: number;
    midfielder: number;
    forward: number;
  };
  description: string;
}

// Helper component for weekly performance
const WeeklyPerformanceCard = ({ player }: { player: Player }) => {
  const { data: weeklyData } = useQuery<{
    summary: string;
    improvement: { goals: number; assists: number; matches: number };
  }>({
    queryKey: [`/api/players/${player.id}/weekly-summary`],
  });

  return (
    <div className="bg-gray-50 rounded-lg p-3 border">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium">{player.name}</span>
        <Badge className="bg-green-100 text-green-800">#{player.jerseyNumber}</Badge>
      </div>
      <p className="text-sm text-gray-600">
        {weeklyData?.summary || "Loading weekly summary..."}
      </p>
      {weeklyData?.improvement && (
        <div className="flex gap-2 mt-2">
          {weeklyData.improvement.goals !== 0 && (
            <Badge variant={weeklyData.improvement.goals > 0 ? "default" : "secondary"}>
              Goals: {weeklyData.improvement.goals > 0 ? "+" : ""}{weeklyData.improvement.goals}
            </Badge>
          )}
          {weeklyData.improvement.assists !== 0 && (
            <Badge variant={weeklyData.improvement.assists > 0 ? "default" : "secondary"}>
              Assists: {weeklyData.improvement.assists > 0 ? "+" : ""}{weeklyData.improvement.assists}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};

// Helper component for smart position suggestions
const SmartPositionCard = ({ player }: { player: Player }) => {
  const { data: suggestion } = useQuery<{ suggestedPosition: string }>({
    queryKey: [`/api/players/${player.id}/smart-position`],
  });

  return (
    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border">
      <div>
        <span className="font-medium">{player.name}</span>
        <p className="text-sm text-gray-600">Current: {formatPosition(player.position)}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium">Suggested:</p>
        <Badge className="bg-blue-600 text-white">
          {suggestion?.suggestedPosition ? formatPosition(suggestion.suggestedPosition) : "Loading..."}
        </Badge>
      </div>
    </div>
  );
};

// Helper component for match reminder form
const MatchReminderForm = ({ players }: { players: Player[] }) => {
  const [selectedPlayer, setSelectedPlayer] = useState<string>("");
  const [matchDateTime, setMatchDateTime] = useState<string>("");
  const { toast } = useToast();

  const createReminderMutation = useMutation({
    mutationFn: async (data: { playerId: number; matchTime: string }) => {
      const response = await apiRequest("POST", "/api/reminders", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Reminder Set!",
        description: "Match reminder has been created successfully",
      });
      setSelectedPlayer("");
      setMatchDateTime("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create reminder",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!selectedPlayer || !matchDateTime) {
      toast({
        title: "Missing Information",
        description: "Please select a player and match time",
        variant: "destructive",
      });
      return;
    }

    createReminderMutation.mutate({
      playerId: parseInt(selectedPlayer),
      matchTime: matchDateTime,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="player-select">Select Player</Label>
        <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a player" />
          </SelectTrigger>
          <SelectContent>
            {players.map((player) => (
              <SelectItem key={player.id} value={player.id.toString()}>
                {player.name} (#{player.jerseyNumber})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="match-time">Match Date & Time</Label>
        <Input
          id="match-time"
          type="datetime-local"
          value={matchDateTime}
          onChange={(e) => setMatchDateTime(e.target.value)}
          className="mt-2"
        />
      </div>
      <Button 
        onClick={handleSubmit}
        disabled={createReminderMutation.isPending}
        className="w-full bg-orange-600 hover:bg-orange-700"
      >
        {createReminderMutation.isPending ? (
          <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Clock className="h-4 w-4 mr-2" />
        )}
        Set Reminder (5min alert)
      </Button>
      <p className="text-xs text-gray-500">
        You'll get an alert 5 minutes before the match starts
      </p>
    </div>
  );
};

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedFormation, setSelectedFormation] = useState<Formation | null>(null);
  const [generatedTeam, setGeneratedTeam] = useState<FormationPlayer[]>([]);
  const [naturalLanguageText, setNaturalLanguageText] = useState("");
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const { toast } = useToast();

  // Available formations
  const formations: Formation[] = [
    {
      name: "4-4-2",
      positions: { goalkeeper: 1, defender: 4, midfielder: 4, forward: 2 },
      description: "Classic balanced formation with solid defense and midfield"
    },
    {
      name: "4-3-3",
      positions: { goalkeeper: 1, defender: 4, midfielder: 3, forward: 3 },
      description: "Attack-minded formation with strong wing play"
    },
    {
      name: "3-5-2",
      positions: { goalkeeper: 1, defender: 3, midfielder: 5, forward: 2 },
      description: "Midfield-heavy formation for possession-based play"
    },
    {
      name: "4-2-3-1",
      positions: { goalkeeper: 1, defender: 4, midfielder: 5, forward: 1 },
      description: "Modern formation with defensive midfield and attacking midfielder"
    }
  ];

  // Fetch players
  const { data: players = [], isLoading: playersLoading } = useQuery<Player[]>({
    queryKey: ["/api/players"],
  });

  // Fetch stats
  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/stats"],
  });

  // Registration form
  const form = useForm<InsertPlayer>({
    resolver: zodResolver(insertPlayerSchema),
    defaultValues: {
      name: "",
      position: undefined,
      jerseyNumber: undefined,
      phone: "",
      preferredFoot: "right",
      isCheckedIn: false,
      goals: 0,
      assists: 0,
      redCards: 0,
      yellowCards: 0,
      matchesPlayed: 0,
    },
  });

  // Name suggestions functionality
  const { data: suggestions = [] } = useQuery<string[]>({
    queryKey: ["/api/suggestions", nameInput],
    enabled: nameInput.length >= 2,
  });

  useEffect(() => {
    if (nameInput.length >= 2 && suggestions.length > 0) {
      setNameSuggestions(suggestions);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [suggestions, nameInput]);

  // Create player mutation
  const createPlayerMutation = useMutation({
    mutationFn: async (data: InsertPlayer) => {
      const response = await apiRequest("POST", "/api/players", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Success!",
        description: "Player registered successfully!",
      });
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to register player",
        variant: "destructive",
      });
    },
  });

  // Toggle check-in mutation
  const toggleCheckInMutation = useMutation({
    mutationFn: async (playerId: number) => {
      const response = await apiRequest("POST", `/api/players/${playerId}/toggle-checkin`);
      return response.json();
    },
    onSuccess: (updatedPlayer: Player) => {
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Success!",
        description: `${updatedPlayer.name} ${updatedPlayer.isCheckedIn ? 'checked in' : 'checked out'} successfully!`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to toggle check-in status",
        variant: "destructive",
      });
    },
  });

  // Delete player mutation
  const deletePlayerMutation = useMutation({
    mutationFn: async (playerId: number) => {
      await apiRequest("DELETE", `/api/players/${playerId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Success!",
        description: "Player deleted successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete player",
        variant: "destructive",
      });
    },
  });

  // Natural language stats mutation
  const naturalLanguageStatsMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await apiRequest("POST", "/api/stats/natural", { text });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Stats Updated!",
        description: data.message,
      });
      setNaturalLanguageText("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Could not parse stats from text",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertPlayer) => {
    createPlayerMutation.mutate(data);
  };

  // Generate team formation
  const generateTeamFormation = (formation: Formation) => {
    const availablePlayers = players.filter(p => p.isCheckedIn);
    
    if (availablePlayers.length === 0) {
      toast({
        title: "No Players Available",
        description: "No checked-in players available for team formation",
        variant: "destructive",
      });
      return;
    }

    const requiredPlayers = Object.values(formation.positions).reduce((sum, count) => sum + count, 0);
    
    if (availablePlayers.length < requiredPlayers) {
      toast({
        title: "Insufficient Players",
        description: `Need ${requiredPlayers} players for ${formation.name} formation, but only ${availablePlayers.length} are checked in`,
        variant: "destructive",
      });
      return;
    }

    // Group players by position
    const playersByPosition = {
      goalkeeper: availablePlayers.filter(p => p.position === 'goalkeeper'),
      defender: availablePlayers.filter(p => p.position === 'defender'),
      midfielder: availablePlayers.filter(p => p.position === 'midfielder'),
      forward: availablePlayers.filter(p => p.position === 'forward'),
    };

    const selectedPlayers: FormationPlayer[] = [];

    // Try to assign players by preferred position first
    for (const [position, requiredCount] of Object.entries(formation.positions)) {
      const positionKey = position as keyof typeof playersByPosition;
      const positionPlayers = [...playersByPosition[positionKey]];
      
      // Randomly select required players for this position
      for (let i = 0; i < requiredCount && positionPlayers.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * positionPlayers.length);
        const selectedPlayer = positionPlayers.splice(randomIndex, 1)[0];
        selectedPlayers.push({
          id: selectedPlayer.id,
          name: selectedPlayer.name,
          position: position,
          jerseyNumber: selectedPlayer.jerseyNumber
        });
      }
    }

    // If we don't have enough players in preferred positions, fill with available players
    if (selectedPlayers.length < requiredPlayers) {
      const remainingPlayers = availablePlayers.filter(p => 
        !selectedPlayers.some(sp => sp.id === p.id)
      );

      const positionsNeeded = [];
      for (const [position, requiredCount] of Object.entries(formation.positions)) {
        const currentCount = selectedPlayers.filter(p => p.position === position).length;
        for (let i = currentCount; i < requiredCount; i++) {
          positionsNeeded.push(position);
        }
      }

      // Randomly assign remaining positions
      for (let i = 0; i < positionsNeeded.length && remainingPlayers.length > 0; i++) {
        const randomPlayerIndex = Math.floor(Math.random() * remainingPlayers.length);
        const randomPlayer = remainingPlayers.splice(randomPlayerIndex, 1)[0];
        
        selectedPlayers.push({
          id: randomPlayer.id,
          name: randomPlayer.name,
          position: positionsNeeded[i],
          jerseyNumber: randomPlayer.jerseyNumber
        });
      }
    }

    setGeneratedTeam(selectedPlayers);
    setSelectedFormation(formation);
    
    toast({
      title: "Team Formation Generated!",
      description: `Successfully generated ${formation.name} formation with ${selectedPlayers.length} players`,
    });
  };

  // Filter players based on search and filters
  const filteredPlayers = players.filter((player) => {
    const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         player.jerseyNumber.toString().includes(searchTerm);
    const matchesPosition = !positionFilter || positionFilter === "all" || player.position === positionFilter;
    const matchesStatus = !statusFilter || statusFilter === "all" ||
                         (statusFilter === "checked-in" && player.isCheckedIn) ||
                         (statusFilter === "checked-out" && !player.isCheckedIn);
    
    return matchesSearch && matchesPosition && matchesStatus;
  });

  const recentPlayers = players
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);



  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-soccer-green p-2 rounded-lg">
                <Users className="text-white h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Soccer Team Manager</h1>
                <p className="text-sm text-gray-500">Player Registration & Check-in System</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge className="bg-soccer-green text-white">
                {stats?.totalPlayers || 0} Players Registered
              </Badge>
              <Badge className="bg-field-green text-white">
                {stats?.checkedInPlayers || 0} Checked In
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="register" className="space-y-8">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="register" className="flex items-center space-x-2">
              <UserPlus className="h-4 w-4" />
              <span>Register Player</span>
            </TabsTrigger>
            <TabsTrigger value="checkin" className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4" />
              <span>Check-in System</span>
            </TabsTrigger>
            <TabsTrigger value="formation" className="flex items-center space-x-2">
              <Zap className="h-4 w-4" />
              <span>Team Formation</span>
            </TabsTrigger>
            <TabsTrigger value="advanced" className="flex items-center space-x-2">
              <Star className="h-4 w-4" />
              <span>Advanced Features</span>
            </TabsTrigger>
            <TabsTrigger value="players" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>All Players</span>
            </TabsTrigger>
          </TabsList>

          {/* Registration Tab */}
          <TabsContent value="register">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Registration Form */}
              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="bg-soccer-green p-3 rounded-lg">
                      <UserPlus className="text-white h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl">Register New Player</CardTitle>
                      <p className="text-gray-600">Add a new player to the team roster</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Player Name <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input 
                                  placeholder="Enter player's full name" 
                                  {...field}
                                  onChange={(e) => {
                                    field.onChange(e);
                                    setNameInput(e.target.value);
                                  }}
                                  onFocus={() => setShowSuggestions(nameSuggestions.length > 0)}
                                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                />
                                {showSuggestions && nameSuggestions.length > 0 && (
                                  <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1">
                                    {nameSuggestions.map((suggestion, index) => (
                                      <div
                                        key={index}
                                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                                        onClick={() => {
                                          field.onChange(suggestion);
                                          setNameInput(suggestion);
                                          setShowSuggestions(false);
                                        }}
                                      >
                                        {suggestion}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="preferredFoot"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Preferred Foot</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select preferred foot" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="right">Right</SelectItem>
                                <SelectItem value="left">Left</SelectItem>
                                <SelectItem value="both">Both</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="position"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Position <span className="text-red-500">*</span>
                            </FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select player position" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="goalkeeper">Goalkeeper (GK)</SelectItem>
                                <SelectItem value="defender">Defender (DF)</SelectItem>
                                <SelectItem value="midfielder">Midfielder (MF)</SelectItem>
                                <SelectItem value="forward">Forward (FW)</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="jerseyNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Jersey Number <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="1-99"
                                min={1}
                                max={99}
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input placeholder="(555) 123-4567" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        className="w-full bg-soccer-green hover:bg-green-700"
                        disabled={createPlayerMutation.isPending}
                      >
                        {createPlayerMutation.isPending ? (
                          <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <UserPlus className="h-4 w-4 mr-2" />
                        )}
                        Register Player
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <div className="space-y-6">
                {/* Position Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Position Distribution</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Goalkeepers</span>
                      <Badge className="bg-blue-100 text-blue-800">
                        {stats?.positionCounts?.goalkeeper || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Defenders</span>
                      <Badge className="bg-red-100 text-red-800">
                        {stats?.positionCounts?.defender || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Midfielders</span>
                      <Badge className="bg-yellow-100 text-yellow-800">
                        {stats?.positionCounts?.midfielder || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Forwards</span>
                      <Badge className="bg-green-100 text-green-800">
                        {stats?.positionCounts?.forward || 0}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Registrations */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Registrations</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {recentPlayers.length === 0 ? (
                      <p className="text-gray-500 text-center">No players registered yet</p>
                    ) : (
                      recentPlayers.map((player) => (
                        <div key={player.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                          <div className="bg-soccer-green text-white rounded-full w-10 h-10 flex items-center justify-center font-semibold">
                            {player.jerseyNumber}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{player.name}</p>
                            <p className="text-sm text-gray-500">{formatPosition(player.position)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Check-in Tab */}
          <TabsContent value="checkin">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Check-in List */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="bg-field-green p-3 rounded-lg">
                          <CheckCircle className="text-white h-6 w-6" />
                        </div>
                        <div>
                          <CardTitle className="text-2xl">Player Check-in</CardTitle>
                          <p className="text-gray-600">Track player attendance for today's session</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Today's Date</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {new Date().toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Search and Filter */}
                    <div className="mb-6 flex flex-col sm:flex-row gap-4">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          placeholder="Search players..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <Select value={positionFilter} onValueChange={setPositionFilter}>
                        <SelectTrigger className="w-full sm:w-48">
                          <SelectValue placeholder="All Positions" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Positions</SelectItem>
                          <SelectItem value="goalkeeper">Goalkeepers</SelectItem>
                          <SelectItem value="defender">Defenders</SelectItem>
                          <SelectItem value="midfielder">Midfielders</SelectItem>
                          <SelectItem value="forward">Forwards</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Player List */}
                    <div className="space-y-3">
                      {playersLoading ? (
                        <p className="text-center text-gray-500">Loading players...</p>
                      ) : filteredPlayers.length === 0 ? (
                        <p className="text-center text-gray-500">No players found</p>
                      ) : (
                        filteredPlayers.map((player) => (
                          <div
                            key={player.id}
                            className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center space-x-4">
                              <div className="bg-soccer-green text-white rounded-full w-12 h-12 flex items-center justify-center font-bold text-lg">
                                {player.jerseyNumber}
                              </div>
                              <div>
                                <h3 className="font-semibold text-gray-900">{player.name}</h3>
                                <p className="text-sm text-gray-500">{formatPosition(player.position)}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-4">
                              <Badge className={player.isCheckedIn ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                                {player.isCheckedIn ? (
                                  <>
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Checked In
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Not Checked In
                                  </>
                                )}
                              </Badge>
                              <Button
                                onClick={() => toggleCheckInMutation.mutate(player.id)}
                                disabled={toggleCheckInMutation.isPending}
                                variant={player.isCheckedIn ? "destructive" : "default"}
                                className={!player.isCheckedIn ? "bg-soccer-green hover:bg-green-700" : ""}
                                size="sm"
                              >
                                {player.isCheckedIn ? "Check Out" : "Check In"}
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Check-in Summary */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Today's Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Total Players</span>
                      <span className="text-2xl font-bold text-gray-900">{stats?.totalPlayers || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Checked In</span>
                      <span className="text-2xl font-bold text-green-600">{stats?.checkedInPlayers || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Attendance Rate</span>
                      <span className="text-2xl font-bold text-blue-600">{stats?.attendanceRate || 0}%</span>
                    </div>
                    <div className="bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${stats?.attendanceRate || 0}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Team Formation Tab */}
          <TabsContent value="formation">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Formation Selection */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <div className="flex items-center space-x-3">
                      <div className="bg-orange-500 p-3 rounded-lg">
                        <Zap className="text-white h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl">Team Formation Generator</CardTitle>
                        <p className="text-gray-600">Randomly assign checked-in players to team formations</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Available Formations */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Choose Formation</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {formations.map((formation) => (
                          <Card key={formation.name} className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-soccer-green">
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xl font-bold text-soccer-green">{formation.name}</h4>
                                <div className="text-sm text-gray-500">
                                  {Object.values(formation.positions).reduce((sum, count) => sum + count, 0)} players
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <p className="text-sm text-gray-600 mb-3">{formation.description}</p>
                              <div className="flex flex-wrap gap-2 mb-4">
                                <Badge className="bg-blue-100 text-blue-800">
                                  <Shield className="h-3 w-3 mr-1" />
                                  GK: {formation.positions.goalkeeper}
                                </Badge>
                                <Badge className="bg-red-100 text-red-800">
                                  <Shield className="h-3 w-3 mr-1" />
                                  DF: {formation.positions.defender}
                                </Badge>
                                <Badge className="bg-yellow-100 text-yellow-800">
                                  <Activity className="h-3 w-3 mr-1" />
                                  MF: {formation.positions.midfielder}
                                </Badge>
                                <Badge className="bg-green-100 text-green-800">
                                  <Target className="h-3 w-3 mr-1" />
                                  FW: {formation.positions.forward}
                                </Badge>
                              </div>
                              <Button 
                                onClick={() => generateTeamFormation(formation)}
                                className="w-full bg-soccer-green hover:bg-green-700"
                              >
                                <Zap className="h-4 w-4 mr-2" />
                                Generate {formation.name}
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>

                    {/* Generated Team */}
                    {generatedTeam.length > 0 && selectedFormation && (
                      <div>
                        <h3 className="text-lg font-semibold mb-4">
                          Generated Team - {selectedFormation.name}
                        </h3>
                        <div className="bg-field-green/10 border border-field-green/20 rounded-lg p-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Goalkeeper */}
                            <div>
                              <h4 className="font-semibold text-blue-800 mb-2 flex items-center">
                                <Shield className="h-4 w-4 mr-1" />
                                Goalkeeper
                              </h4>
                              {generatedTeam
                                .filter(player => player.position === 'goalkeeper')
                                .map(player => (
                                  <div key={player.id} className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-2">
                                    <div className="flex items-center space-x-2">
                                      <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">
                                        {player.jerseyNumber}
                                      </div>
                                      <span className="text-sm font-medium">{player.name}</span>
                                    </div>
                                  </div>
                                ))}
                            </div>

                            {/* Defenders */}
                            <div>
                              <h4 className="font-semibold text-red-800 mb-2 flex items-center">
                                <Shield className="h-4 w-4 mr-1" />
                                Defenders
                              </h4>
                              {generatedTeam
                                .filter(player => player.position === 'defender')
                                .map(player => (
                                  <div key={player.id} className="bg-red-50 border border-red-200 rounded-lg p-2 mb-2">
                                    <div className="flex items-center space-x-2">
                                      <div className="bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">
                                        {player.jerseyNumber}
                                      </div>
                                      <span className="text-sm font-medium">{player.name}</span>
                                    </div>
                                  </div>
                                ))}
                            </div>

                            {/* Midfielders */}
                            <div>
                              <h4 className="font-semibold text-yellow-800 mb-2 flex items-center">
                                <Activity className="h-4 w-4 mr-1" />
                                Midfielders
                              </h4>
                              {generatedTeam
                                .filter(player => player.position === 'midfielder')
                                .map(player => (
                                  <div key={player.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-2">
                                    <div className="flex items-center space-x-2">
                                      <div className="bg-yellow-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">
                                        {player.jerseyNumber}
                                      </div>
                                      <span className="text-sm font-medium">{player.name}</span>
                                    </div>
                                  </div>
                                ))}
                            </div>

                            {/* Forwards */}
                            <div>
                              <h4 className="font-semibold text-green-800 mb-2 flex items-center">
                                <Target className="h-4 w-4 mr-1" />
                                Forwards
                              </h4>
                              {generatedTeam
                                .filter(player => player.position === 'forward')
                                .map(player => (
                                  <div key={player.id} className="bg-green-50 border border-green-200 rounded-lg p-2 mb-2">
                                    <div className="flex items-center space-x-2">
                                      <div className="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">
                                        {player.jerseyNumber}
                                      </div>
                                      <span className="text-sm font-medium">{player.name}</span>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>

                          <div className="mt-4 flex justify-center">
                            <Button 
                              onClick={() => {
                                setGeneratedTeam([]);
                                setSelectedFormation(null);
                              }}
                              variant="outline"
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Clear Formation
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Formation Stats Sidebar */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Available Players</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Total Checked In</span>
                        <Badge className="bg-field-green text-white">
                          {players.filter(p => p.isCheckedIn).length}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Goalkeepers</span>
                        <Badge className="bg-blue-100 text-blue-800">
                          {players.filter(p => p.isCheckedIn && p.position === 'goalkeeper').length}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Defenders</span>
                        <Badge className="bg-red-100 text-red-800">
                          {players.filter(p => p.isCheckedIn && p.position === 'defender').length}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Midfielders</span>
                        <Badge className="bg-yellow-100 text-yellow-800">
                          {players.filter(p => p.isCheckedIn && p.position === 'midfielder').length}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Forwards</span>
                        <Badge className="bg-green-100 text-green-800">
                          {players.filter(p => p.isCheckedIn && p.position === 'forward').length}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {generatedTeam.length === 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>How It Works</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-gray-600 space-y-2">
                      <p>1. Select a formation from the available options</p>
                      <p>2. The system will randomly assign checked-in players to positions</p>
                      <p>3. Players are first assigned to their preferred positions when possible</p>
                      <p>4. Remaining spots are filled randomly from available players</p>
                      <p className="text-amber-600 font-medium">Note: Only checked-in players will be included in formations</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Advanced Features Tab */}
          <TabsContent value="advanced">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Natural Language Stats */}
              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="bg-purple-500 p-3 rounded-lg">
                      <MessageSquare className="text-white h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Natural Language Stats</CardTitle>
                      <p className="text-gray-600">Update player stats using natural language</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="natural-stats">Enter stats description</Label>
                    <Input
                      id="natural-stats"
                      placeholder="e.g., 'John scored 2 goals and got a yellow card'"
                      value={naturalLanguageText}
                      onChange={(e) => setNaturalLanguageText(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <Button 
                    onClick={() => naturalLanguageStatsMutation.mutate(naturalLanguageText)}
                    disabled={!naturalLanguageText.trim() || naturalLanguageStatsMutation.isPending}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    {naturalLanguageStatsMutation.isPending ? (
                      <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <MessageSquare className="h-4 w-4 mr-2" />
                    )}
                    Parse & Update Stats
                  </Button>
                  <div className="text-sm text-gray-500">
                    <p className="font-medium mb-1">Examples:</p>
                    <ul className="space-y-1">
                      <li>• "Alex scored 3 goals"</li>
                      <li>• "Maria got a red card and 1 assist"</li>
                      <li>• "David scored and got a yellow card"</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* Weekly Performance Summary */}
              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="bg-green-500 p-3 rounded-lg">
                      <TrendingUp className="text-white h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Weekly Performance</CardTitle>
                      <p className="text-gray-600">View player performance summaries</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {players.slice(0, 3).map((player) => (
                      <WeeklyPerformanceCard key={player.id} player={player} />
                    ))}
                    {players.length === 0 && (
                      <p className="text-gray-500 text-center py-4">No players registered yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Smart Position Assignment */}
              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-500 p-3 rounded-lg">
                      <Lightbulb className="text-white h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Smart Position Assignment</CardTitle>
                      <p className="text-gray-600">AI-suggested positions based on history</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {players.slice(0, 5).map((player) => (
                      <SmartPositionCard key={player.id} player={player} />
                    ))}
                    {players.length === 0 && (
                      <p className="text-gray-500 text-center py-4">No players available</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Match Reminders */}
              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="bg-orange-500 p-3 rounded-lg">
                      <Clock className="text-white h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Match Reminders</CardTitle>
                      <p className="text-gray-600">Set up countdown timers for matches</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <MatchReminderForm players={players} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* All Players Tab */}
          <TabsContent value="players">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-500 p-3 rounded-lg">
                      <Users className="text-white h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl">All Players</CardTitle>
                      <p className="text-gray-600">Complete roster with player details and status</p>
                    </div>
                  </div>
                  <div className="flex space-x-3">
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Export List
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Search and Filter Controls */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search by name or jersey number..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Select value={positionFilter} onValueChange={setPositionFilter}>
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue placeholder="All Positions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Positions</SelectItem>
                        <SelectItem value="goalkeeper">Goalkeepers</SelectItem>
                        <SelectItem value="defender">Defenders</SelectItem>
                        <SelectItem value="midfielder">Midfielders</SelectItem>
                        <SelectItem value="forward">Forwards</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="checked-in">Checked In</SelectItem>
                        <SelectItem value="checked-out">Checked Out</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Players Table */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Player</TableHead>
                        <TableHead>Jersey #</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {playersLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center">Loading players...</TableCell>
                        </TableRow>
                      ) : filteredPlayers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center">No players found</TableCell>
                        </TableRow>
                      ) : (
                        filteredPlayers.map((player) => (
                          <TableRow key={player.id} className="hover:bg-gray-50">
                            <TableCell>
                              <div className="flex items-center space-x-3">
                                <div className="bg-soccer-green text-white rounded-full w-10 h-10 flex items-center justify-center font-bold">
                                  {player.jerseyNumber}
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">{player.name}</div>
                                  <div className="text-sm text-gray-500">
                                    Registered {new Date(player.createdAt).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">#{player.jerseyNumber}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={getPositionColor(player.position)}>
                                {formatPosition(player.position)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {player.phone ? (
                                <div className="flex items-center space-x-1">
                                  <Phone className="h-3 w-3" />
                                  <span className="text-sm">{player.phone}</span>
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={player.isCheckedIn ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                                {player.isCheckedIn ? (
                                  <>
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Checked In
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Not Checked In
                                  </>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end space-x-2">
                                <Button variant="ghost" size="sm">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deletePlayerMutation.mutate(player.id)}
                                  disabled={deletePlayerMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
