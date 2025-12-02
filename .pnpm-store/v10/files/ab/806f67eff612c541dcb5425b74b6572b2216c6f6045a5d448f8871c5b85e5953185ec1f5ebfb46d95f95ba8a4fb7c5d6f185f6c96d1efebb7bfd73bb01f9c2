export interface SpeakerResponse {
    scenario: string;
    status: SpeakerStatus;
    verificationResult?: VerificationResult;
    identificationResult?: IdentificationResult;
}
export interface SpeakerStatus {
    statusCode: string;
    reason: string;
}
export interface VerificationResult {
    recognitionResult: string;
    profileId: string;
    score: number;
}
export interface IdentificationResult {
    identifiedProfile: ProfileScore;
    profilesRanking: ProfileScore[];
}
export interface ProfileScore {
    profileId: string;
    score: number;
}
export interface EnrollmentResponse {
    scenario: string;
    status: SpeakerStatus;
    enrollment: EnrollmentStatus;
    profiles: IProfile[];
}
export interface ProfileResponse {
    scenario: string;
    operation: string;
    status: SpeakerStatus;
    profiles: IProfile[];
    profileId?: string;
}
export interface ProfilePhraseResponse {
    status: SpeakerStatus;
    passPhraseType: string;
    locale: string;
    phrases: string[];
}
export interface IProfile {
    profileId: string;
    profileStatus: string;
    enrollmentStatus: string;
    enrollmentCount: number;
    enrollmentLength: number;
    enrollmentSpeechLength: number;
    remainingEnrollmentCount: number;
    remainingEnrollmentLength: number;
    remainingEnrollmentSpeechLength: number;
    locale: string;
    passPhrase: string;
}
export interface EnrollmentStatus {
    profileId: string;
    enrollmentStatus: string;
    enrollmentLength: number;
    enrollmentSpeechLength: number;
    remainingEnrollmentCount: number;
    remainingEnrollmentSpeechLength: number;
    audioLength: number;
    audioSpeechLength: number;
}
