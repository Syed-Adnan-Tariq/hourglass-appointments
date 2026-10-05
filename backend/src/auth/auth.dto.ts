import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class SignupDto {
  @IsString() @MinLength(1) @MaxLength(120) name: string;
  @IsEmail() @MaxLength(255) email: string;
  @IsString() @MinLength(8) @MaxLength(72) password: string;
}

export class LoginDto {
  @IsEmail() email: string;
  @IsString() @MaxLength(72) password: string;
}
